use anchor_lang::prelude::*;

#[error_code]
pub enum InceptCometManagerError {
    #[msg("Can't perform this action when in termination sequence")]
    InvalidActionWhenInTerminationSequence,
    #[msg("Must perform this action when in termination sequence")]
    MustBeInTerminationSequence,
    #[msg("Threshold must be greater than protocol threshold")]
    ThresholdTooLow,
    #[msg("Comet must have no liquidity positions")]
    CometMustHaveNoPositions,
    #[msg("Too early to claim reward")]
    TooEarlyToClaimReward,
    #[msg("Invalid membership token balance")]
    InvalidMembershipTokenBalance,
    #[msg("Too early to perform final termination")]
    TooEarlyToPerformTermination,
}
