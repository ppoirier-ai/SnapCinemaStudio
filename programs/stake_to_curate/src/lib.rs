use anchor_lang::prelude::*;

declare_id!("4azLw8hCLoPiED81CNGXx5tthAsJUxm64P6kEnbg74ye");

#[program]
pub mod stake_to_curate {
    use super::*;

    /// Placeholder: set up program-owned state. Replace with slot/version accounts per spec.
    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("StakeToCurate: scaffold OK — implement stake_up / stake_down / …");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
