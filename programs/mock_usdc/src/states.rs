use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct MockUsdc {
    pub mock_usdc_mint: Pubkey,
}
