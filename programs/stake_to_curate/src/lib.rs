use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    hash::hash,
    program::{invoke, invoke_signed},
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
};

declare_id!("UfaPFjHzepp91cEzmfoAd2b7bMVWoB37wuPRa8vy9Su");

/// Minimum initial rank / down-stake floor (lamports-scale weight).
const MIN_INITIAL_RANK: u64 = 1_000_000;

/// Rank moves by `amount / RANK_STAKE_SCALE` (min 1 per non-zero stake) while the vault still
/// receives the full `amount` lamports — so e.g. 0.01 SOL reactions nudge rank less than 1:1.
const RANK_STAKE_SCALE: u64 = 10;

fn rank_delta(amount: u64) -> Result<u64> {
    require!(amount > 0, ErrorCode::ZeroAmount);
    let q = amount
        .checked_div(RANK_STAKE_SCALE)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(if q == 0 { 1 } else { q })
}

#[program]
pub mod stake_to_curate {
    use super::*;

    pub fn initialize_slot(ctx: Context<InitializeSlot>, slot_id: u8) -> Result<()> {
        let slot = &mut ctx.accounts.slot;
        slot.authority = ctx.accounts.authority.key();
        slot.creator = ctx.accounts.creator.key();
        slot.platform = ctx.accounts.platform.key();
        slot.slot_id = slot_id;
        slot.bump = ctx.bumps.slot;
        slot.vault_bump = ctx.bumps.vault;
        slot.total_principal_locked = 0;
        slot.yield_treasury = Pubkey::default();
        Ok(())
    }

    /// Authority sets where surplus vault SOL is sent for automated yield routing.
    pub fn configure_yield_treasury(
        ctx: Context<ConfigureYieldTreasury>,
        treasury: Pubkey,
    ) -> Result<()> {
        require!(treasury != Pubkey::default(), ErrorCode::ZeroAmount);
        ctx.accounts.slot.yield_treasury = treasury;
        Ok(())
    }

    /// Permissionless: sweep up to `amount` lamports to `yield_treasury` if vault retains
    /// rent + `total_principal_locked`.
    pub fn crank_sweep_yield_pool(ctx: Context<CrankSweepYieldPool>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);
        let slot = &ctx.accounts.slot;
        require!(
            slot.yield_treasury != Pubkey::default(),
            ErrorCode::TreasuryNotConfigured
        );
        require_keys_eq!(
            ctx.accounts.yield_treasury.key(),
            slot.yield_treasury,
            ErrorCode::WrongTreasury
        );

        let vault_info = ctx.accounts.vault.to_account_info();
        let rent = Rent::get()?;
        let min_vault = rent.minimum_balance(vault_info.data_len());
        let vault_lamports = vault_info.lamports();
        let max_sweep = vault_lamports
            .saturating_sub(slot.total_principal_locked)
            .saturating_sub(min_vault);
        require!(amount <= max_sweep, ErrorCode::InsufficientSweepable);

        transfer_from_vault(
            &vault_info,
            &ctx.accounts.yield_treasury.to_account_info(),
            slot,
            amount,
            &ctx.accounts.system_program.to_account_info(),
        )?;
        Ok(())
    }

    /// Contributor registers a playable scene and pays rent (one `scene_key` per movie/column/cell id tuple).
    /// `reserved_by` is set to the contributor; slot authority is not required to sign.
    pub fn register_scene(
        ctx: Context<RegisterScene>,
        scene_key: [u8; 32],
        initial_rank: u64,
    ) -> Result<()> {
        let rank = initial_rank.max(MIN_INITIAL_RANK);
        let s = &mut ctx.accounts.scene;
        s.slot = ctx.accounts.slot.key();
        s.scene_key = scene_key;
        s.rank = rank;
        s.active_stake = 0;
        s.bump = ctx.bumps.scene;
        s.reserved_by = ctx.accounts.contributor.key();
        Ok(())
    }

    pub fn stake_scene_up(ctx: Context<PlaceStakeScene>, amount: u64) -> Result<()> {
        stake_scene_internal(ctx, amount, true)
    }

    pub fn stake_scene_down(ctx: Context<PlaceStakeScene>, amount: u64) -> Result<()> {
        stake_scene_internal(ctx, amount, false)
    }

    pub fn unstake_scene(ctx: Context<UnstakeSceneAccounts>) -> Result<()> {
        let position = &mut ctx.accounts.position;
        require_keys_eq!(position.owner, ctx.accounts.owner.key(), ErrorCode::NotOwner);
        let amt = position.amount;
        require!(amt > 0, ErrorCode::NothingToUnstake);

        let scene = &mut ctx.accounts.scene;
        let slot = &mut ctx.accounts.slot;

        slot.total_principal_locked = slot
            .total_principal_locked
            .checked_sub(amt)
            .ok_or(ErrorCode::MathOverflow)?;

        transfer_from_vault(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.owner.to_account_info(),
            slot,
            amt,
            &ctx.accounts.system_program.to_account_info(),
        )?;

        let residual = (amt / 100).max(1);
        let rd = rank_delta(amt)?;
        scene.rank = scene
            .rank
            .checked_sub(rd)
            .ok_or(ErrorCode::MathOverflow)?;
        scene.rank = scene
            .rank
            .checked_add(residual)
            .ok_or(ErrorCode::MathOverflow)?;
        scene.active_stake = scene
            .active_stake
            .checked_sub(amt)
            .ok_or(ErrorCode::MathOverflow)?;

        position.amount = 0;
        position.is_active = false;
        Ok(())
    }

    /// Slot authority resets on-chain rank (e.g. demo reset). Does not move lamports.
    pub fn reset_scene_rank(ctx: Context<ResetSceneRank>, new_rank: u64) -> Result<()> {
        require!(new_rank >= 1, ErrorCode::ZeroAmount);
        ctx.accounts.scene.rank = new_rank.max(MIN_INITIAL_RANK);
        Ok(())
    }
}

fn stake_scene_internal(ctx: Context<PlaceStakeScene>, amount: u64, is_up: bool) -> Result<()> {
    require!(amount > 0, ErrorCode::ZeroAmount);
    require_keys_eq!(
        ctx.accounts.scene.slot,
        ctx.accounts.slot.key(),
        ErrorCode::SlotMismatch
    );

    let scene = &mut ctx.accounts.scene;
    let position = &mut ctx.accounts.position;
    let slot = &mut ctx.accounts.slot;

    if position.owner == Pubkey::default() {
        position.owner = ctx.accounts.owner.key();
        position.scene = scene.key();
        position.is_up = is_up;
        position.bump = ctx.bumps.position;
    } else {
        require_keys_eq!(position.owner, ctx.accounts.owner.key(), ErrorCode::NotOwner);
        require_keys_eq!(position.scene, scene.key(), ErrorCode::WrongScene);
        require!(position.is_up == is_up, ErrorCode::SideMismatch);
    }

    let entry_snapshot = scene.rank;

    let owner_k = ctx.accounts.owner.key();
    let vault_k = ctx.accounts.vault.key();
    invoke(
        &system_instruction::transfer(&owner_k, &vault_k, amount),
        &[
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    slot.total_principal_locked = slot
        .total_principal_locked
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    let rd = rank_delta(amount)?;
    if is_up {
        scene.rank = scene
            .rank
            .checked_add(rd)
            .ok_or(ErrorCode::MathOverflow)?;
    } else {
        require!(
            scene.rank
                >= MIN_INITIAL_RANK
                    .checked_add(rd)
                    .ok_or(ErrorCode::MathOverflow)?,
            ErrorCode::DownStakeRankFloor
        );
        scene.rank = scene
            .rank
            .checked_sub(rd)
            .ok_or(ErrorCode::MathOverflow)?;
    }
    scene.active_stake = scene
        .active_stake
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    position.entry_rank = entry_snapshot;
    position.amount = position
        .amount
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    position.is_active = true;
    position.is_up = is_up;
    Ok(())
}

fn transfer_from_vault<'info>(
    vault: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    slot: &Account<Slot>,
    amount: u64,
    system_program: &AccountInfo<'info>,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let slot_key = slot.key();
    let bump = [slot.vault_bump];
    let seeds: &[&[u8]] = &[b"vault", slot_key.as_ref(), bump.as_ref()];
    invoke_signed(
        &system_instruction::transfer(vault.key, to.key, amount),
        &[vault.clone(), to.clone(), system_program.clone()],
        &[seeds],
    )?;
    Ok(())
}

/// Deterministic `scene_key` matching the app (SHA-256 over UTF-8 ids with 0x00 separators).
pub fn scene_key_from_ids(movie_id: &str, column_id: &str, cell_id: &str) -> [u8; 32] {
    let mut buf: Vec<u8> = Vec::with_capacity(
        movie_id.len() + column_id.len() + cell_id.len() + 2,
    );
    buf.extend_from_slice(movie_id.as_bytes());
    buf.push(0);
    buf.extend_from_slice(column_id.as_bytes());
    buf.push(0);
    buf.extend_from_slice(cell_id.as_bytes());
    hash(&buf).to_bytes()
}

#[account]
#[derive(InitSpace)]
pub struct Slot {
    pub authority: Pubkey,
    pub creator: Pubkey,
    pub platform: Pubkey,
    pub slot_id: u8,
    pub bump: u8,
    pub vault_bump: u8,
    /// Sum of active position principal owed from the vault.
    pub total_principal_locked: u64,
    /// Surplus above principal may be swept to this account via `crank_sweep_yield_pool`.
    pub yield_treasury: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct StakeVault {}

#[account]
#[derive(InitSpace)]
pub struct Scene {
    pub slot: Pubkey,
    pub scene_key: [u8; 32],
    pub rank: u64,
    pub active_stake: u64,
    pub bump: u8,
    /// Wallet that paid rent to create this scene (fills URL off-chain). `default` = legacy authority-registered.
    pub reserved_by: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct ScenePosition {
    pub scene: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub is_up: bool,
    pub is_active: bool,
    pub entry_rank: u64,
    /// Reserved for a future per-scene `deposit_revenue` milestone (always 0 today).
    pub accrued_rewards: u64,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(slot_id: u8)]
pub struct InitializeSlot<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: stored in Slot
    pub creator: UncheckedAccount<'info>,
    /// CHECK: stored in Slot
    pub platform: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Slot::INIT_SPACE,
        seeds = [b"slot", authority.key().as_ref(), &[slot_id]],
        bump
    )]
    pub slot: Account<'info, Slot>,
    #[account(
        init,
        payer = authority,
        space = 8 + StakeVault::INIT_SPACE,
        seeds = [b"vault", slot.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, StakeVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(scene_key: [u8; 32], initial_rank: u64)]
pub struct RegisterScene<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,
    pub slot: Account<'info, Slot>,
    #[account(
        init,
        payer = contributor,
        space = 8 + Scene::INIT_SPACE,
        seeds = [b"scene", slot.key().as_ref(), scene_key.as_ref()],
        bump
    )]
    pub scene: Account<'info, Scene>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceStakeScene<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub slot: Account<'info, Slot>,
    #[account(mut, constraint = scene.slot == slot.key() @ ErrorCode::SlotMismatch)]
    pub scene: Account<'info, Scene>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + ScenePosition::INIT_SPACE,
        seeds = [b"position", scene.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, ScenePosition>,
    #[account(
        mut,
        seeds = [b"vault", slot.key().as_ref()],
        bump = slot.vault_bump
    )]
    pub vault: Account<'info, StakeVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnstakeSceneAccounts<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub slot: Account<'info, Slot>,
    #[account(mut, constraint = scene.slot == slot.key() @ ErrorCode::SlotMismatch)]
    pub scene: Account<'info, Scene>,
    #[account(
        mut,
        seeds = [b"position", scene.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        constraint = position.scene == scene.key() @ ErrorCode::WrongScene
    )]
    pub position: Account<'info, ScenePosition>,
    #[account(
        mut,
        seeds = [b"vault", slot.key().as_ref()],
        bump = slot.vault_bump
    )]
    pub vault: Account<'info, StakeVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfigureYieldTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = slot.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub slot: Account<'info, Slot>,
}

#[derive(Accounts)]
pub struct CrankSweepYieldPool<'info> {
    pub slot: Account<'info, Slot>,
    #[account(
        mut,
        seeds = [b"vault", slot.key().as_ref()],
        bump = slot.vault_bump
    )]
    pub vault: Account<'info, StakeVault>,
    /// CHECK: must match `slot.yield_treasury`
    #[account(mut)]
    pub yield_treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResetSceneRank<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        constraint = slot.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub slot: Account<'info, Slot>,
    #[account(
        mut,
        constraint = scene.slot == slot.key() @ ErrorCode::SlotMismatch
    )]
    pub scene: Account<'info, Scene>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scene_key_from_ids_is_deterministic() {
        let a = scene_key_from_ids("movie", "col", "cell");
        let b = scene_key_from_ids("movie", "col", "cell");
        assert_eq!(a, b);
    }

    #[test]
    fn scene_key_changes_with_ids() {
        let a = scene_key_from_ids("m", "c", "1");
        let b = scene_key_from_ids("m", "c", "2");
        assert_ne!(a, b);
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Slot mismatch")]
    SlotMismatch,
    #[msg("Wrong scene")]
    WrongScene,
    #[msg("Not owner")]
    NotOwner,
    #[msg("Side mismatch (use matching stake_scene_up / stake_scene_down)")]
    SideMismatch,
    #[msg("Nothing to unstake")]
    NothingToUnstake,
    #[msg("Zero amount")]
    ZeroAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Down stake would push scene rank below its floor")]
    DownStakeRankFloor,
    #[msg("Yield treasury not configured")]
    TreasuryNotConfigured,
    #[msg("Not enough surplus in vault to sweep")]
    InsufficientSweepable,
    #[msg("Yield treasury account does not match slot")]
    WrongTreasury,
}
