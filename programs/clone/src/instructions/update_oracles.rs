use crate::error::CloneError;
use crate::states::*;
use crate::{return_error_if_false, CLONE_PROGRAM_SEED, ORACLES_SEED};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum UpdateOracleParameters {
    Add {
        address: Pubkey,
        source: OracleSource,
        rescale_factor: Option<u8>,
    },
    Remove {
        index: u8,
    },
    Modify {
        index: u8,
        address: Option<Pubkey>,
        source: Option<OracleSource>,
        status: Option<Status>,
    },
}

#[derive(Accounts)]
#[instruction(
    params: UpdateOracleParameters
)]
pub struct UpdateOracles<'info> {
    pub auth: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [ORACLES_SEED.as_ref()],
        bump,
    )]
    pub oracles: Box<Account<'info, Oracles>>,
}

pub fn execute(ctx: Context<UpdateOracles>, params: UpdateOracleParameters) -> Result<()> {
    let clone = &ctx.accounts.clone;
    let clone_auth = clone.auth;
    let auth_key = ctx.accounts.auth.key();
    let is_admin = auth_key.eq(&clone.admin);
    let is_auth = clone_auth.iter().any(|auth| auth_key.eq(auth));

    let oracles = &mut ctx.accounts.oracles.oracles;

    match params {
        UpdateOracleParameters::Add {
            address,
            source,
            rescale_factor,
        } => {
            return_error_if_false!(is_admin, CloneError::Unauthorized);
            oracles.push(OracleInfo {
                source,
                address,
                status: Status::Active,
                rescale_factor: rescale_factor.unwrap_or(OracleInfo::default().rescale_factor),
                ..OracleInfo::default()
            });
        }
        UpdateOracleParameters::Remove { index } => {
            return_error_if_false!(is_admin, CloneError::Unauthorized);
            oracles.remove(index.into());
        }
        UpdateOracleParameters::Modify {
            index,
            address,
            source,
            status,
        } => {
            let oracle = &mut oracles[index as usize];
            if let Some(addr) = address {
                return_error_if_false!(is_admin, CloneError::Unauthorized);
                oracle.address = addr;
            }
            if let Some(src) = source {
                return_error_if_false!(is_admin, CloneError::Unauthorized);
                oracle.source = src;
            }
            if let Some(sts) = status {
                return_error_if_false!(
                    is_admin || (is_auth && sts == Status::Frozen),
                    CloneError::Unauthorized
                );
                oracle.status = sts;
            }
        }
    }

    Ok(())
}
