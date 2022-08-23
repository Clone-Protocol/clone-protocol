use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, amount: u64)]
pub struct MintUSDIHackathon<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = usdi_mint,
        has_one = token_data
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = manager.usdi_mint
    )]
    pub usdi_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = user
    )]
    pub user_usdi_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'a, 'b, 'c, 'info> From<&MintUSDIHackathon<'info>>
    for CpiContext<'a, 'b, 'c, 'info, MintTo<'info>>
{
    fn from(accounts: &MintUSDIHackathon<'info>) -> CpiContext<'a, 'b, 'c, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: accounts.usdi_mint.to_account_info().clone(),
            to: accounts.user_usdi_token_account.to_account_info().clone(),
            authority: accounts.manager.to_account_info().clone(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn execute(ctx: Context<MintUSDIHackathon>, manager_nonce: u8, amount: u64) -> ProgramResult {
    //This instruction is for hackathon use ONLY!!!!
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

    // mint usdi to user
    let cpi_ctx_mint: CpiContext<MintTo> = CpiContext::from(&*ctx.accounts).with_signer(seeds);
    mint_to(cpi_ctx_mint, amount)?;

    Ok(())
}
