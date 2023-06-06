//use crate::instructions::InitializeComet;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use rust_decimal::prelude::*;

#[derive(Accounts)]
#[instruction(is_single_pool: bool)]
pub struct InitializeComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, User>,
    #[account(zero)]
    pub comet: AccountLoader<'info, Comet>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeComet>, is_single_pool: bool) -> Result<()> {
    let mut comet = ctx.accounts.comet.load_init()?;

    // set user data
    if is_single_pool {
        comet.is_single_pool = 1;
        ctx.accounts.user_account.single_pool_comets = *ctx.accounts.comet.to_account_info().key;
    } else {
        ctx.accounts.user_account.comet = *ctx.accounts.comet.to_account_info().key;
        // Initialize with onUSD as collateral for multipool.
        comet.add_collateral(CometCollateral {
            authority: *ctx.accounts.user.to_account_info().key,
            collateral_amount: RawDecimal::from(Decimal::new(0, DEVNET_TOKEN_SCALE)),
            collateral_index: ONUSD_COLLATERAL_INDEX as u64,
        });
    }
    // set user as owner
    comet.owner = *ctx.accounts.user.to_account_info().key;
    Ok(())
}
