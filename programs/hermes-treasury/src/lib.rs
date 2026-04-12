use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Token, TokenAccount, Transfer, Mint};

declare_id!("6GnjyP3TcWW47Hnjaw7WZqV8SFBgeQnzv4FBCmvAWD71");

/// Treasury program for $HERMES token operations.
/// Manages burns, distributions to stakers, and spending limits.
/// The token itself is created by bags.fm; this program manages treasury ops.
#[program]
pub mod hermes_treasury {
    use super::*;

    /// Initialize the treasury configuration.
    pub fn initialize(
        ctx: Context<InitializeTreasury>,
        daily_spend_limit_bps: u16,
        monthly_burn_rate_bps: u16,
    ) -> Result<()> {
        require!(daily_spend_limit_bps <= 1000, TreasuryError::SpendLimitTooHigh);
        require!(monthly_burn_rate_bps <= 1000, TreasuryError::BurnRateTooHigh);

        let config = &mut ctx.accounts.treasury_config;
        config.authority = ctx.accounts.authority.key();
        config.token_mint = ctx.accounts.token_mint.key();
        config.treasury_token_account = ctx.accounts.treasury_token_account.key();
        config.daily_spend_limit_bps = daily_spend_limit_bps;
        config.monthly_burn_rate_bps = monthly_burn_rate_bps;
        config.last_burn_timestamp = Clock::get()?.unix_timestamp;
        config.total_burned = 0;
        config.total_distributed = 0;
        config.daily_spent = 0;
        config.last_spend_reset = Clock::get()?.unix_timestamp;
        config.bump = ctx.bumps.treasury_config;

        msg!("Treasury initialized: daily_limit={}bps, burn_rate={}bps",
            daily_spend_limit_bps, monthly_burn_rate_bps);
        Ok(())
    }

    /// Burn tokens from the treasury. Enforces monthly burn schedule.
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, TreasuryError::ZeroAmount);

        let config = &ctx.accounts.treasury_config;
        let treasury_balance = ctx.accounts.treasury_token_account.amount;

        // Enforce burn doesn't exceed monthly rate
        let max_burn = treasury_balance
            .checked_mul(config.monthly_burn_rate_bps as u64)
            .ok_or(TreasuryError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(TreasuryError::MathOverflow)?;
        require!(amount <= max_burn, TreasuryError::BurnExceedsLimit);

        let authority_key = config.authority;
        let seeds = &[
            b"treasury_config",
            authority_key.as_ref(),
            &[config.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.treasury_config.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        let config = &mut ctx.accounts.treasury_config;
        config.total_burned = config.total_burned
            .checked_add(amount)
            .ok_or(TreasuryError::MathOverflow)?;
        config.last_burn_timestamp = Clock::get()?.unix_timestamp;

        msg!("Burned {} $HERMES. Total burned: {}", amount, config.total_burned);
        Ok(())
    }

    /// Distribute tokens from treasury to a recipient (e.g., staking rewards pool).
    /// Enforces daily spending limit.
    pub fn distribute(ctx: Context<Distribute>, amount: u64) -> Result<()> {
        require!(amount > 0, TreasuryError::ZeroAmount);

        let config = &ctx.accounts.treasury_config;
        let now = Clock::get()?.unix_timestamp;

        // Reset daily counter if new day
        let seconds_per_day: i64 = 86_400;
        let mut daily_spent = config.daily_spent;
        if now.checked_sub(config.last_spend_reset).unwrap_or(0) >= seconds_per_day {
            daily_spent = 0;
        }

        // Check daily limit
        let treasury_balance = ctx.accounts.treasury_token_account.amount;
        let daily_limit = treasury_balance
            .checked_mul(config.daily_spend_limit_bps as u64)
            .ok_or(TreasuryError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(TreasuryError::MathOverflow)?;

        let new_daily_spent = daily_spent
            .checked_add(amount)
            .ok_or(TreasuryError::MathOverflow)?;
        require!(new_daily_spent <= daily_limit, TreasuryError::DailyLimitExceeded);

        let authority_key = config.authority;
        let seeds = &[
            b"treasury_config",
            authority_key.as_ref(),
            &[config.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.treasury_token_account.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.treasury_config.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        let config = &mut ctx.accounts.treasury_config;
        config.total_distributed = config.total_distributed
            .checked_add(amount)
            .ok_or(TreasuryError::MathOverflow)?;
        config.daily_spent = new_daily_spent;
        if now.checked_sub(config.last_spend_reset).unwrap_or(0) >= seconds_per_day {
            config.last_spend_reset = now;
        }

        msg!("Distributed {} $HERMES. Total distributed: {}", amount, config.total_distributed);
        Ok(())
    }

    /// Update treasury configuration. Authority only.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        daily_spend_limit_bps: Option<u16>,
        monthly_burn_rate_bps: Option<u16>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.treasury_config;

        if let Some(limit) = daily_spend_limit_bps {
            require!(limit <= 1000, TreasuryError::SpendLimitTooHigh);
            config.daily_spend_limit_bps = limit;
        }
        if let Some(rate) = monthly_burn_rate_bps {
            require!(rate <= 1000, TreasuryError::BurnRateTooHigh);
            config.monthly_burn_rate_bps = rate;
        }

        msg!("Treasury config updated");
        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + TreasuryConfig::INIT_SPACE,
        seeds = [b"treasury_config", authority.key().as_ref()],
        bump,
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = treasury_token_account.mint == token_mint.key(),
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury_config", authority.key().as_ref()],
        bump = treasury_config.bump,
        has_one = authority,
        has_one = token_mint,
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = treasury_token_account.key() == treasury_config.treasury_token_account,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Distribute<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury_config", authority.key().as_ref()],
        bump = treasury_config.bump,
        has_one = authority,
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    #[account(
        mut,
        constraint = treasury_token_account.key() == treasury_config.treasury_token_account,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury_config", authority.key().as_ref()],
        bump = treasury_config.bump,
        has_one = authority,
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct TreasuryConfig {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub treasury_token_account: Pubkey,
    pub daily_spend_limit_bps: u16,
    pub monthly_burn_rate_bps: u16,
    pub last_burn_timestamp: i64,
    pub total_burned: u64,
    pub total_distributed: u64,
    pub daily_spent: u64,
    pub last_spend_reset: i64,
    pub bump: u8,
}

// === Errors ===

#[error_code]
pub enum TreasuryError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Daily spending limit exceeded")]
    DailyLimitExceeded,
    #[msg("Burn amount exceeds monthly rate limit")]
    BurnExceedsLimit,
    #[msg("Daily spend limit cannot exceed 10%")]
    SpendLimitTooHigh,
    #[msg("Monthly burn rate cannot exceed 10%")]
    BurnRateTooHigh,
    #[msg("Math overflow")]
    MathOverflow,
}
