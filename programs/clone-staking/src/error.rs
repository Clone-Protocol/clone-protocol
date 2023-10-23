use anchor_lang::prelude::*;

#[error_code]
pub enum CloneStakingError {
    #[msg("Cannot withdraw before the staking period ends!")]
    CannotWithdrawBeforeStakingPeriod,

    #[msg("Input is invalid!")]
    InvalidInput,

    #[msg("Bump not found")]
    BumpNotFound,
}
