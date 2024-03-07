use crate::initialize::MANAGER_SEED;
use crate::states::*;
use anchor_lang::__private::bytemuck;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use clone::cpi::accounts::PayImpermanentLossDebt;
use clone::cpi::pay_impermanent_loss_debt;
use clone::instructions::pay_impermanent_loss_debt::PaymentType as ClonePaymentType;
use clone::instructions::{CLONE_PROGRAM_SEED, POOLS_SEED, USER_SEED};
use clone::{
    program::Clone,
    states::Clone as CloneAccount,
    states::{Pools, User},
};

#[derive(Clone, Debug, PartialEq, AnchorSerialize, AnchorDeserialize)]
pub enum PaymentType {
    Onasset,
    Collateral,
    CollateralFromWallet,
}

impl Into<ClonePaymentType> for PaymentType {
    fn into(self) -> ClonePaymentType {
        match self {
            PaymentType::Onasset => ClonePaymentType::Onasset,
            PaymentType::Collateral => ClonePaymentType::Collateral,
            PaymentType::CollateralFromWallet => ClonePaymentType::CollateralFromWallet,
        }
    }
}

#[derive(Accounts)]
#[instruction(owner: Pubkey, position_index: u8, amount: u64, payment_type: PaymentType)]
pub struct PayIsolatedCometImpermanentLossDebt<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [MANAGER_SEED.as_ref(), owner.as_ref()],
        bump,
    )]
    pub manager_account: Account<'info, PositionManager>,
    #[account(
        seeds = [&[manager_account.account_seeds[position_index as usize]], manager_account.to_account_info().key.as_ref()],
        bump,
    )]
    pub owner_account: Account<'info, CometOwner>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), owner_account.to_account_info().key.as_ref()],
        bump,
        seeds::program = clone_program.key(),
    )]
    pub user_account: Account<'info, User>,
    pub clone_program: Program<'info, Clone>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump,
        seeds::program = clone_program.key(),
    )]
    pub clone_account: Box<Account<'info, CloneAccount>>,
    #[account(
        address = clone_account.collateral.mint,
    )]
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        seeds = [POOLS_SEED.as_ref()],
        bump,
        seeds::program = clone_program.key(),
    )]
    pub pools: Account<'info, Pools>,
    #[account(
        address = pools.pools[user_account.comet.positions[0].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = collateral_mint,
        token::authority = payer
    )]
    pub payer_collateral_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = onasset_mint,
        token::authority = payer
    )]
    pub payer_onasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = clone_account.collateral.vault,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<PayIsolatedCometImpermanentLossDebt>,
    _owner: Pubkey,
    position_index: u8,
    amount: u64,
    payment_type: PaymentType,
) -> Result<()> {
    let position_manager = &ctx.accounts.manager_account;
    let position_index = position_index as usize;

    let unique_seed = position_manager.account_seeds[position_index];
    let manager_pubkey = ctx.accounts.manager_account.key();
    let inner_seed = [unique_seed];
    let seeds = &[&[
        &inner_seed,
        manager_pubkey.as_ref(),
        bytemuck::bytes_of(ctx.bumps.get("owner_account").unwrap()),
    ][..]];

    let cpi_accounts = PayImpermanentLossDebt {
        payer: ctx.accounts.payer.to_account_info().clone(),
        pools: ctx.accounts.pools.to_account_info().clone(),
        user_account: ctx.accounts.user_account.to_account_info().clone(),
        clone: ctx.accounts.clone_account.to_account_info().clone(),
        collateral_mint: ctx.accounts.collateral_mint.to_account_info().clone(),
        collateral_vault: ctx.accounts.vault.to_account_info().clone(),
        onasset_mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        payer_collateral_token_account: ctx
            .accounts
            .payer_collateral_token_account
            .to_account_info()
            .clone(),
        payer_onasset_token_account: ctx
            .accounts
            .payer_onasset_token_account
            .to_account_info()
            .clone(),
        token_program: ctx.accounts.token_program.to_account_info().clone(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.clone_program.to_account_info(),
        cpi_accounts,
        seeds,
    );

    pay_impermanent_loss_debt(
        cpi_ctx,
        ctx.accounts.owner_account.to_account_info().key(),
        0,
        amount,
        payment_type.into(),
    )
}
