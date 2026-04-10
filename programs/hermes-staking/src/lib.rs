use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnT");

/// Staking program for $HERMES.
/// Users stake $HERMES to earn yield from treasury distributions.
/// Includes time-locked staking with configurable parameters.
#[program]
pub mod hermes_staking {
    use super::*;

    /// Initialize the staking pool with configurable parameters.
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        reward_rate_bps: u16,
        lock_period_seconds: i64,
        burn_rate_bps: u16,
        min_stake_amount: u64,
    ) -> Result<()> {
        require!(reward_rate_bps > 0 && reward_rate_bps <= 5000, StakingError::InvalidRewardRate);
        require!(lock_period_seconds >= 86_400 && lock_period_seconds <= 7_776_000, StakingError::InvalidLockPeriod);
        require!(burn_rate_bps <= 1000, StakingError::InvalidBurnRate);
        require!(min_stake_amount > 0, StakingError::InvalidMinStake);

        let pool = &mut ctx.accounts.stake_pool;
        pool.authority = ctx.accounts.authority.key();
        pool.token_mint = ctx.accounts.token_mint.key();
        pool.pool_token_account = ctx.accounts.pool_token_account.key();
        pool.reward_rate_bps = reward_rate_bps;
        pool.lock_period_seconds = lock_period_seconds;
        pool.burn_rate_bps = burn_rate_bps;
        pool.min_stake_amount = min_stake_amount;
        pool.total_staked = 0;
        pool.total_stakers = 0;
        pool.total_rewards_distributed = 0;
        pool.created_at = Clock::get()?.unix_timestamp;
        pool.bump = ctx.bumps.stake_pool;

        msg!("Staking pool initialized: reward={}bps, lock={}s, burn={}bps, min={}",
            reward_rate_bps, lock_period_seconds, burn_rate_bps, min_stake_amount);
        Ok(())
    }

    /// Stake $HERMES tokens into the pool.
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let pool = &ctx.accounts.stake_pool;
        require!(amount >= pool.min_stake_amount, StakingError::BelowMinStake);

        // Transfer tokens from user to pool
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.pool_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let user_stake = &mut ctx.accounts.user_stake;
        let now = Clock::get()?.unix_timestamp;

        if user_stake.amount == 0 {
            // New staker
            let pool = &mut ctx.accounts.stake_pool;
            pool.total_stakers = pool.total_stakers
                .checked_add(1)
                .ok_or(StakingError::MathOverflow)?;
            user_stake.owner = ctx.accounts.user.key();
            user_stake.pool = ctx.accounts.stake_pool.key();
            user_stake.staked_at = now;
            user_stake.last_claim = now;
            user_stake.bump = ctx.bumps.user_stake;
        }

        user_stake.amount = user_stake.amount
            .checked_add(amount)
            .ok_or(StakingError::MathOverflow)?;
        user_stake.unlock_at = now
            .checked_add(ctx.accounts.stake_pool.lock_period_seconds)
            .ok_or(StakingError::MathOverflow)?;

        let pool = &mut ctx.accounts.stake_pool;
        pool.total_staked = pool.total_staked
            .checked_add(amount)
            .ok_or(StakingError::MathOverflow)?;

        msg!("Staked {} $HERMES. Total staked: {}", amount, pool.total_staked);
        Ok(())
    }

    /// Unstake $HERMES tokens. Must be past lock period.
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);

        let user_stake = &ctx.accounts.user_stake;
        require!(amount <= user_stake.amount, StakingError::InsufficientStake);

        let now = Clock::get()?.unix_timestamp;
        require!(now >= user_stake.unlock_at, StakingError::StillLocked);

        let pool = &ctx.accounts.stake_pool;
        let authority_key = pool.authority;
        let seeds = &[
            b"stake_pool",
            authority_key.as_ref(),
            &[pool.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.stake_pool.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        let user_stake = &mut ctx.accounts.user_stake;
        user_stake.amount = user_stake.amount
            .checked_sub(amount)
            .ok_or(StakingError::MathOverflow)?;

        let pool = &mut ctx.accounts.stake_pool;
        pool.total_staked = pool.total_staked
            .checked_sub(amount)
            .ok_or(StakingError::MathOverflow)?;

        if user_stake.amount == 0 {
            pool.total_stakers = pool.total_stakers.saturating_sub(1);
        }

        msg!("Unstaked {} $HERMES. Remaining: {}", amount, user_stake.amount);
        Ok(())
    }

    /// Claim pending staking rewards.
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let user_stake = &ctx.accounts.user_stake;
        require!(user_stake.amount > 0, StakingError::NoStake);

        let now = Clock::get()?.unix_timestamp;
        let seconds_staked = now
            .checked_sub(user_stake.last_claim)
            .ok_or(StakingError::MathOverflow)?;
        require!(seconds_staked > 0, StakingError::NothingToClaim);

        let pool = &ctx.accounts.stake_pool;

        // Calculate rewards: (staked * rate * time) / (365 days * 10000)
        let seconds_per_year: u128 = 365 * 86_400;
        let rewards = (user_stake.amount as u128)
            .checked_mul(pool.reward_rate_bps as u128)
            .ok_or(StakingError::MathOverflow)?
            .checked_mul(seconds_staked as u128)
            .ok_or(StakingError::MathOverflow)?
            .checked_div(seconds_per_year.checked_mul(10_000).ok_or(StakingError::MathOverflow)?)
            .ok_or(StakingError::MathOverflow)?;

        let rewards_u64 = u64::try_from(rewards).map_err(|_| StakingError::MathOverflow)?;
        require!(rewards_u64 > 0, StakingError::NothingToClaim);

        // Check pool has enough rewards
        let pool_balance = ctx.accounts.rewards_token_account.amount;
        require!(rewards_u64 <= pool_balance, StakingError::InsufficientRewards);

        let authority_key = pool.authority;
        let seeds = &[
            b"stake_pool",
            authority_key.as_ref(),
            &[pool.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.rewards_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.stake_pool.to_account_info(),
                },
                signer_seeds,
            ),
            rewards_u64,
        )?;

        let user_stake = &mut ctx.accounts.user_stake;
        user_stake.last_claim = now;

        let pool = &mut ctx.accounts.stake_pool;
        pool.total_rewards_distributed = pool.total_rewards_distributed
            .checked_add(rewards_u64)
            .ok_or(StakingError::MathOverflow)?;

        msg!("Claimed {} $HERMES rewards", rewards_u64);
        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + StakePool::INIT_SPACE,
        seeds = [b"stake_pool", authority.key().as_ref()],
        bump,
    )]
    pub stake_pool: Account<'info, StakePool>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = pool_token_account.mint == token_mint.key(),
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"stake_pool", stake_pool.authority.as_ref()],
        bump = stake_pool.bump,
    )]
    pub stake_pool: Account<'info, StakePool>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStake::INIT_SPACE,
        seeds = [b"user_stake", stake_pool.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == stake_pool.token_mint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_account.key() == stake_pool.pool_token_account,
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"stake_pool", stake_pool.authority.as_ref()],
        bump = stake_pool.bump,
    )]
    pub stake_pool: Account<'info, StakePool>,

    #[account(
        mut,
        seeds = [b"user_stake", stake_pool.key().as_ref(), user.key().as_ref()],
        bump = user_stake.bump,
        constraint = user_stake.owner == user.key() @ StakingError::Unauthorized,
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == stake_pool.token_mint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_account.key() == stake_pool.pool_token_account,
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"stake_pool", stake_pool.authority.as_ref()],
        bump = stake_pool.bump,
    )]
    pub stake_pool: Account<'info, StakePool>,

    #[account(
        mut,
        seeds = [b"user_stake", stake_pool.key().as_ref(), user.key().as_ref()],
        bump = user_stake.bump,
        constraint = user_stake.owner == user.key() @ StakingError::Unauthorized,
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == stake_pool.token_mint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Separate rewards token account (funded by treasury distributions)
    #[account(
        mut,
        constraint = rewards_token_account.mint == stake_pool.token_mint,
    )]
    pub rewards_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct StakePool {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub pool_token_account: Pubkey,
    pub reward_rate_bps: u16,
    pub lock_period_seconds: i64,
    pub burn_rate_bps: u16,
    pub min_stake_amount: u64,
    pub total_staked: u64,
    pub total_stakers: u64,
    pub total_rewards_distributed: u64,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserStake {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub amount: u64,
    pub staked_at: i64,
    pub unlock_at: i64,
    pub last_claim: i64,
    pub bump: u8,
}

// === Errors ===

#[error_code]
pub enum StakingError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Amount below minimum stake")]
    BelowMinStake,
    #[msg("Insufficient staked balance")]
    InsufficientStake,
    #[msg("Tokens are still locked")]
    StillLocked,
    #[msg("No tokens staked")]
    NoStake,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Insufficient rewards in pool")]
    InsufficientRewards,
    #[msg("Reward rate must be 1-5000 basis points")]
    InvalidRewardRate,
    #[msg("Lock period must be 1-90 days")]
    InvalidLockPeriod,
    #[msg("Burn rate cannot exceed 10%")]
    InvalidBurnRate,
    #[msg("Minimum stake must be greater than zero")]
    InvalidMinStake,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
}
