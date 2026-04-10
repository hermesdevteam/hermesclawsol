use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnU");

/// Token launchpad: others can launch tokens through the HermesClawSol agent.
/// Contributors send SOL. On finalization, tokens are distributed and a fee goes to treasury.
#[program]
pub mod hermes_launchpad {
    use super::*;

    /// Create a new token launch.
    pub fn create_launch(
        ctx: Context<CreateLaunch>,
        name: String,
        target_sol: u64,
        launch_fee_bps: u16,
        duration_seconds: i64,
    ) -> Result<()> {
        require!(name.len() <= 50, LaunchpadError::NameTooLong);
        require!(target_sol > 0, LaunchpadError::InvalidTarget);
        require!(launch_fee_bps >= 50 && launch_fee_bps <= 500, LaunchpadError::InvalidFeeRate);
        require!(duration_seconds >= 86_400 && duration_seconds <= 2_592_000, LaunchpadError::InvalidDuration);

        let now = Clock::get()?.unix_timestamp;
        let launch = &mut ctx.accounts.launch;
        launch.authority = ctx.accounts.authority.key();
        launch.creator = ctx.accounts.creator.key();
        launch.name = name;
        launch.target_sol = target_sol;
        launch.raised_sol = 0;
        launch.launch_fee_bps = launch_fee_bps;
        launch.total_contributors = 0;
        launch.created_at = now;
        launch.expires_at = now.checked_add(duration_seconds).ok_or(LaunchpadError::MathOverflow)?;
        launch.finalized = false;
        launch.bump = ctx.bumps.launch;

        msg!("Launch created: {}, target {} SOL", launch.name, target_sol);
        Ok(())
    }

    /// Contribute SOL to an active launch.
    pub fn contribute(ctx: Context<Contribute>, amount_lamports: u64) -> Result<()> {
        let launch = &ctx.accounts.launch;
        require!(!launch.finalized, LaunchpadError::AlreadyFinalized);
        require!(amount_lamports > 0, LaunchpadError::ZeroAmount);

        let now = Clock::get()?.unix_timestamp;
        require!(now < launch.expires_at, LaunchpadError::LaunchExpired);

        // Transfer SOL from contributor to launch vault (PDA)
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.contributor.to_account_info(),
                    to: ctx.accounts.launch_vault.to_account_info(),
                },
            ),
            amount_lamports,
        )?;

        // Record contribution
        let contribution = &mut ctx.accounts.contribution;
        if contribution.amount == 0 {
            contribution.contributor = ctx.accounts.contributor.key();
            contribution.launch = ctx.accounts.launch.key();
            contribution.bump = ctx.bumps.contribution;

            let launch = &mut ctx.accounts.launch;
            launch.total_contributors = launch.total_contributors
                .checked_add(1)
                .ok_or(LaunchpadError::MathOverflow)?;
        }

        contribution.amount = contribution.amount
            .checked_add(amount_lamports)
            .ok_or(LaunchpadError::MathOverflow)?;

        let launch = &mut ctx.accounts.launch;
        launch.raised_sol = launch.raised_sol
            .checked_add(amount_lamports)
            .ok_or(LaunchpadError::MathOverflow)?;

        msg!("Contributed {} lamports to {}. Total raised: {}",
            amount_lamports, launch.name, launch.raised_sol);
        Ok(())
    }

    /// Finalize a launch. Authority (agent) only.
    /// Transfers fee to treasury, remainder to creator.
    pub fn finalize_launch(ctx: Context<FinalizeLaunch>) -> Result<()> {
        let launch = &ctx.accounts.launch;
        require!(!launch.finalized, LaunchpadError::AlreadyFinalized);
        require!(launch.raised_sol > 0, LaunchpadError::NothingRaised);

        // Calculate fee
        let fee = (launch.raised_sol as u128)
            .checked_mul(launch.launch_fee_bps as u128)
            .ok_or(LaunchpadError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(LaunchpadError::MathOverflow)?;
        let fee_lamports = u64::try_from(fee).map_err(|_| LaunchpadError::MathOverflow)?;
        let creator_amount = launch.raised_sol
            .checked_sub(fee_lamports)
            .ok_or(LaunchpadError::MathOverflow)?;

        let authority_key = launch.authority;
        let name_bytes = launch.name.as_bytes();
        let seeds = &[
            b"launch_vault",
            authority_key.as_ref(),
            &name_bytes[..name_bytes.len().min(32)],
            &[ctx.accounts.launch_vault.to_account_info().try_borrow_data()?[0]], // placeholder
        ];

        // Transfer fee to treasury via direct lamport manipulation (PDA -> treasury)
        let vault_info = ctx.accounts.launch_vault.to_account_info();
        let treasury_info = ctx.accounts.treasury.to_account_info();
        let creator_info = ctx.accounts.creator.to_account_info();

        **vault_info.try_borrow_mut_lamports()? -= fee_lamports;
        **treasury_info.try_borrow_mut_lamports()? += fee_lamports;

        **vault_info.try_borrow_mut_lamports()? -= creator_amount;
        **creator_info.try_borrow_mut_lamports()? += creator_amount;

        let launch = &mut ctx.accounts.launch;
        launch.finalized = true;

        msg!("Launch {} finalized. Creator: {} lamports, Treasury fee: {} lamports",
            launch.name, creator_amount, fee_lamports);
        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateLaunch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Creator receives funds on finalization
    pub creator: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Launch::INIT_SPACE,
        seeds = [b"launch", authority.key().as_ref(), &name.as_bytes()[..name.len().min(32)]],
        bump,
    )]
    pub launch: Account<'info, Launch>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"launch", launch.authority.as_ref(), &launch.name.as_bytes()[..launch.name.len().min(32)]],
        bump = launch.bump,
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        init_if_needed,
        payer = contributor,
        space = 8 + Contribution::INIT_SPACE,
        seeds = [b"contribution", launch.key().as_ref(), contributor.key().as_ref()],
        bump,
    )]
    pub contribution: Account<'info, Contribution>,

    /// CHECK: PDA vault that holds contributed SOL
    #[account(
        mut,
        seeds = [b"launch_vault", launch.authority.as_ref(), &launch.name.as_bytes()[..launch.name.len().min(32)]],
        bump,
    )]
    pub launch_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeLaunch<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"launch", authority.key().as_ref(), &launch.name.as_bytes()[..launch.name.len().min(32)]],
        bump = launch.bump,
        has_one = authority,
    )]
    pub launch: Account<'info, Launch>,

    /// CHECK: PDA vault holding SOL
    #[account(
        mut,
        seeds = [b"launch_vault", authority.key().as_ref(), &launch.name.as_bytes()[..launch.name.len().min(32)]],
        bump,
    )]
    pub launch_vault: UncheckedAccount<'info>,

    /// CHECK: Creator receives funds
    #[account(
        mut,
        constraint = creator.key() == launch.creator @ LaunchpadError::Unauthorized,
    )]
    pub creator: UncheckedAccount<'info>,

    /// CHECK: Treasury receives fee
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct Launch {
    pub authority: Pubkey,
    pub creator: Pubkey,
    #[max_len(50)]
    pub name: String,
    pub target_sol: u64,
    pub raised_sol: u64,
    pub launch_fee_bps: u16,
    pub total_contributors: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub finalized: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub contributor: Pubkey,
    pub launch: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

// === Errors ===

#[error_code]
pub enum LaunchpadError {
    #[msg("Name too long (max 50 chars)")]
    NameTooLong,
    #[msg("Target SOL must be greater than zero")]
    InvalidTarget,
    #[msg("Launch fee must be 50-500 basis points")]
    InvalidFeeRate,
    #[msg("Duration must be 1-30 days")]
    InvalidDuration,
    #[msg("Launch already finalized")]
    AlreadyFinalized,
    #[msg("Launch has expired")]
    LaunchExpired,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Nothing raised to finalize")]
    NothingRaised,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
}
