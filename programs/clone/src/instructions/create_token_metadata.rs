use crate::states::Clone;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use mpl_token_metadata::{
    instructions::{
        CreateMetadataAccountV3Cpi, CreateMetadataAccountV3CpiAccounts,
        CreateMetadataAccountV3InstructionArgs,
    },
    types::DataV2,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct MetadataArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

#[derive(Accounts)]
#[instruction(metadata_args: MetadataArgs)]
pub struct CreateTokenMetadata<'info> {
    #[account(mut, address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = admin
    )]
    pub clone: Account<'info, Clone>,
    /// CHECK: This will be checked by inner instruction
    pub mint: Account<'info, Mint>,
    /// CHECK: This will be checked by inner instruction
    pub metaplex_program: AccountInfo<'info>,
    /// CHECK: This will be checked by inner instruction
    #[account(mut)]
    pub metadata: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CreateTokenMetadata>, metadata_args: MetadataArgs) -> Result<()> {
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];
    let metaplex_program = ctx.accounts.metaplex_program.to_account_info().clone();

    let accounts = CreateMetadataAccountV3CpiAccounts {
        metadata: &ctx.accounts.metadata.to_account_info().clone(),
        mint: &ctx.accounts.mint.to_account_info().clone(),
        mint_authority: &ctx.accounts.clone.to_account_info().clone(),
        payer: &ctx.accounts.admin.to_account_info().clone(),
        update_authority: (&ctx.accounts.admin.to_account_info().clone(), true),
        system_program: &ctx.accounts.system_program.to_account_info().clone(),
        rent: None,
    };

    let instruction_args = CreateMetadataAccountV3InstructionArgs {
        data: DataV2 {
            name: metadata_args.name,
            symbol: metadata_args.symbol,
            uri: metadata_args.uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        is_mutable: true,
        collection_details: None,
    };

    let ix = CreateMetadataAccountV3Cpi::new(&metaplex_program, accounts, instruction_args);

    ix.invoke_signed(seeds)?;

    Ok(())
}
