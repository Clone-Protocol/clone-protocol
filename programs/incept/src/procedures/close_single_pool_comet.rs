use crate::instructions::CloseSinglePoolComet;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

pub fn execute(
    ctx: Context<CloseSinglePoolComet>,
    _user_nonce: u8,
    comet_index: u8,
) -> ProgramResult {
    // remove single pool comet
    ctx.accounts
        .single_pool_comets
        .load_mut()?
        .remove(comet_index as usize);

    let close = ctx.accounts.single_pool_comets.load_mut()?.num_comets == 0;

    // close single pool comet account
    ctx.accounts
        .single_pool_comet
        .close(ctx.accounts.user.to_account_info())?;

    // check to see if single pool comets account should be closed
    if close {
        // close single pool comets account if no comets remain
        ctx.accounts.user_account.single_pool_comets = Pubkey::default();
        ctx.accounts
            .single_pool_comets
            .close(ctx.accounts.user.to_account_info())?;
    }

    Ok(())
}
