use crate::states::*;
use anchor_lang::prelude::*;
use incept::states::DEVNET_TOKEN_SCALE;
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[cfg(feature = "local-testing")]
const FEE_CLAIM_INTERVAL_SLOTS: u64 = 0;
#[cfg(not(feature = "local-testing"))]
const FEE_CLAIM_INTERVAL_SLOTS: u64 = 2592000;

#[derive(Accounts)]
pub struct ManagementFeeClaim<'info> {
    #[account(address = manager_info.owner)]
    pub manager_owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_owner.to_account_info().key().as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        mut,
        seeds = [b"subscriber", manager_owner.to_account_info().key().as_ref(), manager_info.to_account_info().key.as_ref()],
        bump,
    )]
    pub owner_account: Box<Account<'info, Subscriber>>,
}

pub fn execute(ctx: Context<ManagementFeeClaim>) -> Result<()> {
    // Calculate membership amount to mint
    assert!(
        !ctx.accounts.manager_info.in_closing_sequence,
        "Can't claim if closing."
    );
    let current_slot = Clock::get()?.slot;
    assert!(
        current_slot >= ctx.accounts.manager_info.fee_claim_slot + FEE_CLAIM_INTERVAL_SLOTS,
        "Too early to claim!"
    );
    let management_fee_rate = Decimal::new(
        ctx.accounts
            .manager_info
            .management_fee_bps
            .try_into()
            .unwrap(),
        4,
    );
    let total_membership_token_supply = Decimal::new(
        ctx.accounts
            .manager_info
            .membership_token_supply
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let mut membership_token_to_mint =
        total_membership_token_supply * management_fee_rate / (Decimal::ONE - management_fee_rate);
    membership_token_to_mint.rescale(DEVNET_TOKEN_SCALE);

    // Mint membership
    let tokens_to_add: u64 = membership_token_to_mint.mantissa().try_into().unwrap();
    ctx.accounts.owner_account.membership_tokens =
        ctx.accounts.owner_account.membership_tokens + tokens_to_add;
    // Adjust supply
    ctx.accounts.manager_info.membership_token_supply =
        ctx.accounts.manager_info.membership_token_supply + tokens_to_add;
    // Update slot
    ctx.accounts.manager_info.fee_claim_slot = current_slot;

    Ok(())
}