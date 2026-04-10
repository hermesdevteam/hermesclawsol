use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnW");

/// Agent-generated NFT collection minting.
/// Users pay SOL to mint NFTs from the HermesClawSol collection.
/// Mint fees go to treasury.
#[program]
pub mod hermes_nft {
    use super::*;

    /// Initialize the NFT collection config.
    pub fn initialize_collection(
        ctx: Context<InitializeCollection>,
        name: String,
        symbol: String,
        base_uri: String,
        mint_price_lamports: u64,
        max_supply: u64,
    ) -> Result<()> {
        require!(name.len() <= 32, NftError::NameTooLong);
        require!(symbol.len() <= 10, NftError::SymbolTooLong);
        require!(base_uri.len() <= 200, NftError::UriTooLong);
        require!(mint_price_lamports > 0, NftError::InvalidMintPrice);
        require!(max_supply > 0 && max_supply <= 10_000, NftError::InvalidMaxSupply);

        let collection = &mut ctx.accounts.collection;
        collection.authority = ctx.accounts.authority.key();
        collection.treasury = ctx.accounts.treasury.key();
        collection.name = name;
        collection.symbol = symbol;
        collection.base_uri = base_uri;
        collection.mint_price_lamports = mint_price_lamports;
        collection.max_supply = max_supply;
        collection.total_minted = 0;
        collection.is_active = true;
        collection.bump = ctx.bumps.collection;

        msg!("Collection initialized: {} ({}) max={}", collection.name, collection.symbol, max_supply);
        Ok(())
    }

    /// Mint an NFT from the collection. User pays mint price in SOL.
    pub fn mint_nft(ctx: Context<MintNft>) -> Result<()> {
        let collection = &ctx.accounts.collection;
        require!(collection.is_active, NftError::CollectionInactive);
        require!(collection.total_minted < collection.max_supply, NftError::SoldOut);

        let mint_price = collection.mint_price_lamports;

        // Transfer SOL mint price to treasury
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.minter.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            mint_price,
        )?;

        // Capture values before mutable borrow
        let collection_key = ctx.accounts.collection.key();
        let minter_key = ctx.accounts.minter.key();
        let now = Clock::get()?.unix_timestamp;

        let collection = &mut ctx.accounts.collection;
        let token_id = collection.total_minted;
        collection.total_minted = collection.total_minted
            .checked_add(1)
            .ok_or(NftError::MathOverflow)?;

        // Record the mint
        let nft_record = &mut ctx.accounts.nft_record;
        nft_record.collection = collection_key;
        nft_record.owner = minter_key;
        nft_record.token_id = token_id;
        nft_record.minted_at = now;
        nft_record.bump = ctx.bumps.nft_record;

        msg!("Minted NFT #{} from {} to {}",
            token_id, collection.name, minter_key);
        Ok(())
    }

    /// Toggle collection active status. Authority only.
    pub fn toggle_collection(ctx: Context<ToggleCollection>) -> Result<()> {
        let collection = &mut ctx.accounts.collection;
        collection.is_active = !collection.is_active;
        msg!("Collection {} is now {}", collection.name,
            if collection.is_active { "ACTIVE" } else { "PAUSED" });
        Ok(())
    }

    /// Update mint price. Authority only.
    pub fn update_mint_price(ctx: Context<UpdateCollection>, new_price: u64) -> Result<()> {
        require!(new_price > 0, NftError::InvalidMintPrice);
        let collection = &mut ctx.accounts.collection;
        collection.mint_price_lamports = new_price;
        msg!("Mint price updated to {} lamports", new_price);
        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitializeCollection<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Treasury wallet receives mint fees
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Collection::INIT_SPACE,
        seeds = [b"collection", authority.key().as_ref(), &name.as_bytes()[..name.len().min(32)]],
        bump,
    )]
    pub collection: Account<'info, Collection>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"collection", collection.authority.as_ref(), &collection.name.as_bytes()[..collection.name.len().min(32)]],
        bump = collection.bump,
    )]
    pub collection: Account<'info, Collection>,

    #[account(
        init,
        payer = minter,
        space = 8 + NftRecord::INIT_SPACE,
        seeds = [b"nft_record", collection.key().as_ref(), &collection.total_minted.to_le_bytes()],
        bump,
    )]
    pub nft_record: Account<'info, NftRecord>,

    /// CHECK: Treasury receives mint fee
    #[account(
        mut,
        constraint = treasury.key() == collection.treasury @ NftError::Unauthorized,
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ToggleCollection<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"collection", authority.key().as_ref(), &collection.name.as_bytes()[..collection.name.len().min(32)]],
        bump = collection.bump,
        has_one = authority,
    )]
    pub collection: Account<'info, Collection>,
}

#[derive(Accounts)]
pub struct UpdateCollection<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"collection", authority.key().as_ref(), &collection.name.as_bytes()[..collection.name.len().min(32)]],
        bump = collection.bump,
        has_one = authority,
    )]
    pub collection: Account<'info, Collection>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct Collection {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(10)]
    pub symbol: String,
    #[max_len(200)]
    pub base_uri: String,
    pub mint_price_lamports: u64,
    pub max_supply: u64,
    pub total_minted: u64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct NftRecord {
    pub collection: Pubkey,
    pub owner: Pubkey,
    pub token_id: u64,
    pub minted_at: i64,
    pub bump: u8,
}

// === Errors ===

#[error_code]
pub enum NftError {
    #[msg("Name too long (max 32 chars)")]
    NameTooLong,
    #[msg("Symbol too long (max 10 chars)")]
    SymbolTooLong,
    #[msg("URI too long (max 200 chars)")]
    UriTooLong,
    #[msg("Mint price must be greater than zero")]
    InvalidMintPrice,
    #[msg("Max supply must be 1-10000")]
    InvalidMaxSupply,
    #[msg("Collection is not active")]
    CollectionInactive,
    #[msg("Collection sold out")]
    SoldOut,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
}
