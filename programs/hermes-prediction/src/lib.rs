use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnV");

/// Binary prediction markets with $HERMES.
/// Users bet on YES/NO outcomes. Agent or oracle resolves markets.
/// Resolution fee goes to treasury.
#[program]
pub mod hermes_prediction {
    use super::*;

    /// Create a new binary prediction market.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        resolution_fee_bps: u16,
        min_bet_amount: u64,
        duration_seconds: i64,
    ) -> Result<()> {
        require!(question.len() <= 200, PredictionError::QuestionTooLong);
        require!(resolution_fee_bps >= 50 && resolution_fee_bps <= 500, PredictionError::InvalidFeeRate);
        require!(min_bet_amount > 0, PredictionError::InvalidMinBet);
        require!(duration_seconds >= 3600 && duration_seconds <= 2_592_000, PredictionError::InvalidDuration);

        let now = Clock::get()?.unix_timestamp;
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.token_mint = ctx.accounts.token_mint.key();
        market.escrow_account = ctx.accounts.escrow_account.key();
        market.question = question;
        market.resolution_fee_bps = resolution_fee_bps;
        market.min_bet_amount = min_bet_amount;
        market.yes_pool = 0;
        market.no_pool = 0;
        market.total_bettors = 0;
        market.created_at = now;
        market.expires_at = now.checked_add(duration_seconds).ok_or(PredictionError::MathOverflow)?;
        market.resolved = false;
        market.outcome = false;
        market.bump = ctx.bumps.market;

        msg!("Market created: {}", market.question);
        Ok(())
    }

    /// Place a bet on YES or NO.
    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64, bet_yes: bool) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(!market.resolved, PredictionError::MarketResolved);
        require!(amount >= market.min_bet_amount, PredictionError::BelowMinBet);

        let now = Clock::get()?.unix_timestamp;
        require!(now < market.expires_at, PredictionError::MarketExpired);

        // Transfer tokens from user to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.escrow_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Record the bet
        let bet = &mut ctx.accounts.user_bet;
        if bet.amount == 0 {
            bet.owner = ctx.accounts.user.key();
            bet.market = ctx.accounts.market.key();
            bet.bet_yes = bet_yes;
            bet.bump = ctx.bumps.user_bet;

            let market = &mut ctx.accounts.market;
            market.total_bettors = market.total_bettors
                .checked_add(1)
                .ok_or(PredictionError::MathOverflow)?;
        } else {
            require!(bet.bet_yes == bet_yes, PredictionError::CannotSwitchSide);
        }

        bet.amount = bet.amount.checked_add(amount).ok_or(PredictionError::MathOverflow)?;

        let market = &mut ctx.accounts.market;
        if bet_yes {
            market.yes_pool = market.yes_pool.checked_add(amount).ok_or(PredictionError::MathOverflow)?;
        } else {
            market.no_pool = market.no_pool.checked_add(amount).ok_or(PredictionError::MathOverflow)?;
        }

        msg!("Bet placed: {} $HERMES on {}", amount, if bet_yes { "YES" } else { "NO" });
        Ok(())
    }

    /// Resolve a market. Authority (agent) only.
    pub fn resolve_market(ctx: Context<ResolveMarket>, outcome: bool) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, PredictionError::MarketResolved);

        market.resolved = true;
        market.outcome = outcome;

        msg!("Market resolved: {} = {}", market.question, if outcome { "YES" } else { "NO" });
        Ok(())
    }

    /// Claim winnings from a resolved market.
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.resolved, PredictionError::MarketNotResolved);

        let bet = &ctx.accounts.user_bet;
        require!(bet.amount > 0, PredictionError::NoBet);
        require!(bet.bet_yes == market.outcome, PredictionError::DidNotWin);

        // Calculate winnings: (bet / winning_pool) * total_pool * (1 - fee)
        let total_pool = market.yes_pool
            .checked_add(market.no_pool)
            .ok_or(PredictionError::MathOverflow)?;

        let winning_pool = if market.outcome { market.yes_pool } else { market.no_pool };
        require!(winning_pool > 0, PredictionError::MathOverflow);

        // Proportional share of total pool
        let gross_winnings = (bet.amount as u128)
            .checked_mul(total_pool as u128)
            .ok_or(PredictionError::MathOverflow)?
            .checked_div(winning_pool as u128)
            .ok_or(PredictionError::MathOverflow)?;

        // Deduct resolution fee
        let fee = gross_winnings
            .checked_mul(market.resolution_fee_bps as u128)
            .ok_or(PredictionError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(PredictionError::MathOverflow)?;

        let net_winnings = gross_winnings
            .checked_sub(fee)
            .ok_or(PredictionError::MathOverflow)?;

        let net_winnings_u64 = u64::try_from(net_winnings).map_err(|_| PredictionError::MathOverflow)?;
        let fee_u64 = u64::try_from(fee).map_err(|_| PredictionError::MathOverflow)?;

        let authority_key = market.authority;
        let question_bytes = market.question.as_bytes();
        let seeds = &[
            b"market",
            authority_key.as_ref(),
            &question_bytes[..question_bytes.len().min(32)],
            &[market.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        // Transfer winnings to user
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer_seeds,
            ),
            net_winnings_u64,
        )?;

        // Transfer fee to treasury
        if fee_u64 > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_account.to_account_info(),
                        to: ctx.accounts.treasury_token_account.to_account_info(),
                        authority: ctx.accounts.market.to_account_info(),
                    },
                    signer_seeds,
                ),
                fee_u64,
            )?;
        }

        // Zero out bet to prevent double-claim
        let bet = &mut ctx.accounts.user_bet;
        bet.amount = 0;

        msg!("Claimed {} $HERMES (fee: {})", net_winnings_u64, fee_u64);
        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
#[instruction(question: String)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", authority.key().as_ref(), &question.as_bytes()[..question.len().min(32)]],
        bump,
    )]
    pub market: Account<'info, Market>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = escrow_account.mint == token_mint.key(),
    )]
    pub escrow_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market.authority.as_ref(), &market.question.as_bytes()[..market.question.len().min(32)]],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserBet::INIT_SPACE,
        seeds = [b"user_bet", market.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub user_bet: Account<'info, UserBet>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == market.token_mint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = escrow_account.key() == market.escrow_account,
    )]
    pub escrow_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", authority.key().as_ref(), &market.question.as_bytes()[..market.question.len().min(32)]],
        bump = market.bump,
        has_one = authority,
    )]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market.authority.as_ref(), &market.question.as_bytes()[..market.question.len().min(32)]],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"user_bet", market.key().as_ref(), user.key().as_ref()],
        bump = user_bet.bump,
        constraint = user_bet.owner == user.key() @ PredictionError::Unauthorized,
    )]
    pub user_bet: Account<'info, UserBet>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == market.token_mint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = escrow_account.key() == market.escrow_account,
    )]
    pub escrow_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub escrow_account: Pubkey,
    #[max_len(200)]
    pub question: String,
    pub resolution_fee_bps: u16,
    pub min_bet_amount: u64,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub total_bettors: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub resolved: bool,
    pub outcome: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserBet {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub amount: u64,
    pub bet_yes: bool,
    pub bump: u8,
}

// === Errors ===

#[error_code]
pub enum PredictionError {
    #[msg("Question too long (max 200 chars)")]
    QuestionTooLong,
    #[msg("Resolution fee must be 50-500 basis points")]
    InvalidFeeRate,
    #[msg("Minimum bet must be greater than zero")]
    InvalidMinBet,
    #[msg("Duration must be 1 hour to 30 days")]
    InvalidDuration,
    #[msg("Market already resolved")]
    MarketResolved,
    #[msg("Market not yet resolved")]
    MarketNotResolved,
    #[msg("Market has expired")]
    MarketExpired,
    #[msg("Bet below minimum amount")]
    BelowMinBet,
    #[msg("Cannot switch bet side")]
    CannotSwitchSide,
    #[msg("No bet placed")]
    NoBet,
    #[msg("Your side did not win")]
    DidNotWin,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
}
