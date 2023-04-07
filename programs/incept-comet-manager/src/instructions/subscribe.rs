use crate::config::MIN_COLLATERAL_DEPOSIT;
use crate::error::InceptCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use incept::program::Incept as InceptProgram;
use incept::return_error_if_false;
use incept::states::{Comet, Incept, TokenData, User, DEVNET_TOKEN_SCALE, USDI_COLLATERAL_INDEX};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(collateral_to_provide: u64)]
pub struct Subscribe<'info> {
    #[account(address = subscriber_account.owner)]
    pub subscriber: Signer<'info>,
    #[account(
        mut,
        seeds = [b"subscriber", subscriber.to_account_info().key.as_ref(), manager_info.to_account_info().key.as_ref()],
        bump,
    )]
    pub subscriber_account: Box<Account<'info, Subscriber>>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_info.owner.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        address = manager_info.incept
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        address = manager_info.user_account
    )]
    pub manager_incept_user: Box<Account<'info, User>>,
    #[account(
        mut,
        address = incept.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = subscriber
    )]
    pub subscriber_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = manager_info
    )]
    pub manager_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = manager_info.incept_program
    )]
    pub incept_program: Program<'info, InceptProgram>,
    #[account(
        mut,
        address = manager_incept_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDI_COLLATERAL_INDEX].vault
    )]
    pub incept_usdi_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<Subscribe>, collateral_to_provide: u64) -> Result<()> {
    // Calculate membership amount to mint
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        InceptCometManagerError::OpenStatusRequired
    );
    let usdi_collateral_contribution = Decimal::new(
        collateral_to_provide.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    return_error_if_false!(
        usdi_collateral_contribution >= MIN_COLLATERAL_DEPOSIT,
        InceptCometManagerError::DepositAmountTooLow
    );

    let token_data = ctx.accounts.token_data.load()?;
    let comet = ctx.accounts.comet.load()?;

    let mut membership_token_to_mint = if ctx.accounts.manager_info.membership_token_supply == 0 {
        usdi_collateral_contribution
    } else {
        let estimated_usdi_comet_value = comet.estimate_usdi_value(&token_data);
        usdi_collateral_contribution / (usdi_collateral_contribution + estimated_usdi_comet_value)
    };
    membership_token_to_mint.rescale(DEVNET_TOKEN_SCALE);

    // Mint membership
    let tokens_to_add: u64 = membership_token_to_mint.mantissa().try_into().unwrap();
    ctx.accounts.subscriber_account.membership_tokens += tokens_to_add;
    ctx.accounts.manager_info.membership_token_supply += tokens_to_add;
    // Adjust principal
    ctx.accounts.subscriber_account.principal += collateral_to_provide;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer {
                from: ctx
                    .accounts
                    .subscriber_usdi_token_account
                    .to_account_info()
                    .clone(),
                to: ctx
                    .accounts
                    .manager_usdi_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.subscriber.to_account_info().clone(),
            },
        ),
        collateral_to_provide,
    )?;

    // TODO: Create add collateral to comet ix.

    // drop(token_data);
    // drop(comet);
    // // Add collateral to comet
    // incept::cpi::add_collateral_to_comet(
    //     CpiContext::new_with_signer(
    //         ctx.accounts.incept_program.to_account_info(),
    //         AddCollateralToComet {
    //             user: ctx.accounts.manager_info.to_account_info(),
    //             user_account: ctx.accounts.manager_incept_user.to_account_info(),
    //             incept: ctx.accounts.incept.to_account_info(),
    //             token_data: ctx.accounts.token_data.to_account_info(),
    //             token_program: ctx.accounts.token_program.to_account_info(),
    //             comet: ctx.accounts.comet.to_account_info(),
    //             vault: ctx.accounts.incept_usdi_vault.to_account_info(),
    //             user_collateral_token_account: ctx
    //                 .accounts
    //                 .manager_usdi_token_account
    //                 .to_account_info(),
    //         },
    //         manager_seeds,
    //     ),
    //     USDI_COLLATERAL_INDEX.try_into().unwrap(),
    //     collateral_to_provide,
    // )?;

    Ok(())
}
