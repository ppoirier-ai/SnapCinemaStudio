use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::{invoke, invoke_signed},
    system_instruction,
};

declare_id!("4azLw8hCLoPiED81CNGXx5tthAsJUxm64P6kEnbg74ye");

/// Minimum initial rank for the first version (lamports-scale weight).
const MIN_INITIAL_RANK: u64 = 1_000_000;
/// 50 SOL in lamports for bonding-curve denominator (spec: total_active / 50 SOL).
const FIFTY_SOL_LAMPORTS: u64 = 50 * 1_000_000_000;
/// Multiplier fixed-point: 1.0 = 1_000_000.
const MULT_BASE: u128 = 1_000_000;
/// 0.8 * MULT_BASE for bonding bonus numerator scaling.
const EIGHT_TENTHS_MULT: u128 = 800_000;

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
        Ok(())
    }

    pub fn register_version(
        ctx: Context<RegisterVersion>,
        version_index: u8,
        initial_rank: u64,
    ) -> Result<()> {
        require!(version_index < 32, ErrorCode::VersionIndexTooLarge);
        let rank = if version_index == 0 {
            initial_rank.max(MIN_INITIAL_RANK)
        } else {
            initial_rank.max(1)
        };
        let v = &mut ctx.accounts.version;
        v.slot = ctx.accounts.slot.key();
        v.index = version_index;
        v.rank = rank;
        v.active_stake = 0;
        v.curator_carry = 0;
        v.bump = ctx.bumps.version;
        Ok(())
    }

    pub fn stake_up(ctx: Context<PlaceStake>, amount: u64) -> Result<()> {
        stake_internal(ctx, amount, true)
    }

    pub fn stake_down(ctx: Context<PlaceStake>, amount: u64) -> Result<()> {
        stake_internal(ctx, amount, false)
    }

    pub fn unstake(ctx: Context<UnstakeAccounts>) -> Result<()> {
        let position = &mut ctx.accounts.position;
        require_keys_eq!(position.owner, ctx.accounts.owner.key(), ErrorCode::NotOwner);
        let amt = position.amount;
        require!(amt > 0, ErrorCode::NothingToUnstake);

        let version = &mut ctx.accounts.version;
        let slot = &ctx.accounts.slot;

        transfer_from_vault(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.owner.to_account_info(),
            slot,
            amt,
        )?;

        let residual = (amt / 100).max(1);
        version.rank = version
            .rank
            .checked_sub(amt)
            .ok_or(ErrorCode::MathOverflow)?;
        version.rank = version
            .rank
            .checked_add(residual)
            .ok_or(ErrorCode::MathOverflow)?;
        version.active_stake = version
            .active_stake
            .checked_sub(amt)
            .ok_or(ErrorCode::MathOverflow)?;

        position.amount = 0;
        position.is_active = false;
        Ok(())
    }

    /// 20% creator, 10% platform, 70% to curators (normalized by weight).
    /// Remaining accounts: all `Position` PDAs for this version (demo-scale).
    pub fn deposit_revenue(ctx: Context<DepositRevenue>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);
        let version_key = ctx.accounts.version.key();
        let slot = &ctx.accounts.slot;
        let version = &mut ctx.accounts.version;

        let payer_k = ctx.accounts.payer.key();
        let vault_k = ctx.accounts.vault.key();
        invoke(
            &system_instruction::transfer(&payer_k, &vault_k, amount),
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let creator_cut = amount
            .checked_mul(20)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(100)
            .ok_or(ErrorCode::MathOverflow)?;
        let platform_cut = amount
            .checked_mul(10)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(100)
            .ok_or(ErrorCode::MathOverflow)?;
        let curator_cut = amount
            .checked_sub(creator_cut)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_sub(platform_cut)
            .ok_or(ErrorCode::MathOverflow)?;

        transfer_from_vault(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.creator.to_account_info(),
            slot,
            creator_cut,
        )?;
        transfer_from_vault(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.platform.to_account_info(),
            slot,
            platform_cut,
        )?;

        let pool = curator_cut
            .checked_add(version.curator_carry)
            .ok_or(ErrorCode::MathOverflow)?;
        version.curator_carry = 0;

        if pool == 0 {
            return Ok(());
        }

        let mult_bp = bonding_multiplier_bp(version.active_stake);

        let mut total_w: u128 = 0;
        for acc in ctx.remaining_accounts.iter() {
            require_keys_eq!(*acc.owner, crate::ID, ErrorCode::BadOwner);
            let pos = deserialize_position(acc)?;
            require_keys_eq!(pos.version, version_key, ErrorCode::WrongVersion);
            let w = curator_weight(&pos, version, mult_bp)?;
            total_w = total_w.checked_add(w).ok_or(ErrorCode::MathOverflow)?;
        }

        if total_w == 0 {
            version.curator_carry = pool;
            return Ok(());
        }

        for acc in ctx.remaining_accounts.iter() {
            let mut data = acc.try_borrow_mut_data()?;
            let mut r: &[u8] = &data;
            let pos = Position::try_deserialize(&mut r)?;
            require_keys_eq!(pos.version, version_key, ErrorCode::WrongVersion);
            let w = curator_weight(&pos, version, mult_bp)?;
            if w == 0 {
                continue;
            }
            let share: u128 = (pool as u128)
                .checked_mul(w)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(total_w)
                .ok_or(ErrorCode::MathOverflow)?;
            let share_u64: u64 = share.min(u64::MAX as u128) as u64;
            let new_accrued = pos
                .accrued_rewards
                .checked_add(share_u64)
                .ok_or(ErrorCode::MathOverflow)?;
            let mut updated = pos;
            updated.accrued_rewards = new_accrued;
            let mut wbuf: &mut [u8] = &mut data;
            anchor_lang::AccountSerialize::try_serialize(&updated, &mut wbuf)
                .map_err(|_| error!(ErrorCode::SerializeFailed))?;
        }

        Ok(())
    }

    pub fn claim_curator(ctx: Context<ClaimCuratorAccounts>) -> Result<()> {
        let position = &mut ctx.accounts.position;
        require_keys_eq!(position.owner, ctx.accounts.owner.key(), ErrorCode::NotOwner);
        let pay = position.accrued_rewards;
        require!(pay > 0, ErrorCode::NothingToClaim);

        let slot = &ctx.accounts.slot;
        transfer_from_vault(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.owner.to_account_info(),
            slot,
            pay,
        )?;
        position.accrued_rewards = 0;
        Ok(())
    }
}

fn stake_internal(ctx: Context<PlaceStake>, amount: u64, is_up: bool) -> Result<()> {
    require!(amount > 0, ErrorCode::ZeroAmount);
    require_keys_eq!(
        ctx.accounts.version.slot,
        ctx.accounts.slot.key(),
        ErrorCode::SlotMismatch
    );

    let version = &mut ctx.accounts.version;
    let position = &mut ctx.accounts.position;

    if position.owner == Pubkey::default() {
        position.owner = ctx.accounts.owner.key();
        position.version = version.key();
        position.is_up = is_up;
        position.bump = ctx.bumps.position;
    } else {
        require_keys_eq!(position.owner, ctx.accounts.owner.key(), ErrorCode::NotOwner);
        require_keys_eq!(position.version, version.key(), ErrorCode::WrongVersion);
        require!(position.is_up == is_up, ErrorCode::SideMismatch);
    }

    let entry_snapshot = version.rank;

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

    version.rank = version
        .rank
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    version.active_stake = version
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

fn bonding_multiplier_bp(active_stake_lamports: u64) -> u128 {
    let s = active_stake_lamports as u128;
    let fifty = FIFTY_SOL_LAMPORTS as u128;
    let bonus = EIGHT_TENTHS_MULT
        .saturating_mul(fifty)
        .checked_div(fifty.saturating_add(s))
        .unwrap_or(0);
    MULT_BASE.saturating_add(bonus)
}

fn curator_weight(
    position: &Position,
    version: &Version,
    mult_bp: u128,
) -> Result<u128> {
    let favorable: u64 = if position.is_up {
        version.rank.saturating_sub(position.entry_rank)
    } else {
        position.entry_rank.saturating_sub(version.rank)
    };
    let favorable = favorable as u128;
    if favorable == 0 {
        return Ok(0);
    }
    let num = favorable
        .checked_mul(mult_bp)
        .ok_or(ErrorCode::MathOverflow)?;
    let after_mult = num
        .checked_div(MULT_BASE)
        .ok_or(ErrorCode::MathOverflow)?;
    let w = if position.is_active {
        after_mult
    } else {
        after_mult
            .checked_div(100)
            .ok_or(ErrorCode::MathOverflow)?
    };
    Ok(w)
}

fn deserialize_position(acc: &AccountInfo) -> Result<Position> {
    let data = acc.try_borrow_data()?;
    let mut slice: &[u8] = &data;
    Position::try_deserialize(&mut slice).map_err(|_| error!(ErrorCode::DeserializeFailed))
}

fn transfer_from_vault<'info>(
    vault: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    slot: &Account<Slot>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let slot_key = slot.key();
    let bump = [slot.vault_bump];
    let seeds: &[&[u8]] = &[b"vault", slot_key.as_ref(), bump.as_ref()];
    invoke_signed(
        &system_instruction::transfer(vault.key, to.key, amount),
        &[vault.clone(), to.clone()],
        &[seeds],
    )?;
    Ok(())
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
}

#[account]
#[derive(InitSpace)]
pub struct StakeVault {}

#[account]
#[derive(InitSpace)]
pub struct Version {
    pub slot: Pubkey,
    pub index: u8,
    pub rank: u64,
    pub active_stake: u64,
    pub curator_carry: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub version: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub is_up: bool,
    pub is_active: bool,
    pub entry_rank: u64,
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
#[instruction(version_index: u8)]
pub struct RegisterVersion<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        constraint = slot.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub slot: Account<'info, Slot>,
    #[account(
        init,
        payer = authority,
        space = 8 + Version::INIT_SPACE,
        seeds = [b"version", slot.key().as_ref(), &[version_index]],
        bump
    )]
    pub version: Account<'info, Version>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceStake<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub slot: Account<'info, Slot>,
    #[account(mut, constraint = version.slot == slot.key())]
    pub version: Account<'info, Version>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", version.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(
        mut,
        seeds = [b"vault", slot.key().as_ref()],
        bump = slot.vault_bump
    )]
    pub vault: Account<'info, StakeVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnstakeAccounts<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub slot: Account<'info, Slot>,
    #[account(mut, constraint = version.slot == slot.key())]
    pub version: Account<'info, Version>,
    #[account(
        mut,
        seeds = [b"position", version.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        constraint = position.version == version.key()
    )]
    pub position: Account<'info, Position>,
    #[account(
        mut,
        seeds = [b"vault", slot.key().as_ref()],
        bump = slot.vault_bump
    )]
    pub vault: Account<'info, StakeVault>,
}

#[derive(Accounts)]
pub struct DepositRevenue<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, constraint = version.slot == slot.key())]
    pub version: Account<'info, Version>,
    pub slot: Account<'info, Slot>,
    #[account(
        mut,
        seeds = [b"vault", slot.key().as_ref()],
        bump = slot.vault_bump
    )]
    pub vault: Account<'info, StakeVault>,
    /// CHECK: must match slot.creator
    #[account(mut, constraint = creator.key() == slot.creator @ ErrorCode::BadCreator)]
    pub creator: UncheckedAccount<'info>,
    /// CHECK: must match slot.platform
    #[account(mut, constraint = platform.key() == slot.platform @ ErrorCode::BadPlatform)]
    pub platform: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimCuratorAccounts<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub slot: Account<'info, Slot>,
    #[account(mut, constraint = version.slot == slot.key())]
    pub version: Account<'info, Version>,
    #[account(
        mut,
        seeds = [b"position", version.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        constraint = position.version == version.key()
    )]
    pub position: Account<'info, Position>,
    #[account(
        mut,
        seeds = [b"vault", slot.key().as_ref()],
        bump = slot.vault_bump
    )]
    pub vault: Account<'info, StakeVault>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Slot mismatch")]
    SlotMismatch,
    #[msg("Wrong version")]
    WrongVersion,
    #[msg("Not owner")]
    NotOwner,
    #[msg("Side mismatch (use matching stake_up / stake_down)")]
    SideMismatch,
    #[msg("Nothing to unstake")]
    NothingToUnstake,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Zero amount")]
    ZeroAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Version index too large")]
    VersionIndexTooLarge,
    #[msg("Bad account owner")]
    BadOwner,
    #[msg("Deserialize failed")]
    DeserializeFailed,
    #[msg("Serialize failed")]
    SerializeFailed,
    #[msg("Bad creator account")]
    BadCreator,
    #[msg("Bad platform account")]
    BadPlatform,
}
