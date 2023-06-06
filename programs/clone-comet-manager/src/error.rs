use anchor_lang::prelude::*;

#[error_code]
pub enum CloneCometManagerError {
    #[msg("Comet must have no liquidity positions")]
    CometMustHaveNoPositions,
    #[msg("Manager at/beyond strike limit")]
    ManagerAtStrikeLimit,
    #[msg("Require manager to be at/beyond strike limit")]
    RequireManagerAtStrikeLimit,
    #[msg("Too early to claim reward")]
    TooEarlyToClaimReward,
    #[msg("Invalid membership token balance")]
    InvalidMembershipTokenBalance,
    #[msg("Too early to perform final termination")]
    TooEarlyToPerformTermination,
    #[msg("Required that the manager is in open status")]
    OpenStatusRequired,
    #[msg("Required that the manager is in closing status")]
    ClosingStatusRequired,
    #[msg("Request already sent")]
    RequestAlreadySent,
    #[msg("Outstanding request queue is full, try again soon")]
    OutstandingRedemptionsQueueFull,
    #[msg("Invalid index")]
    InvalidIndex,
    #[msg("Request not valid for strike")]
    RequestNotValidForStrike,
    #[msg("Invalid for forcefully closed manager")]
    InvalidForForcefullyClosedManagers,
    #[msg("Valid for forcefully closed manager")]
    MustBeForcefullyClosedManagers,
    #[msg("Deposit amount too low")]
    DepositAmountTooLow,
    #[msg("Invalid withdrawal amount!")]
    WithdrawalAmountInvalid,
    #[msg("All redemptions must be fulfilled!")]
    RedemptionsMustBeFulfilled,
    #[msg("Outdated update slot")]
    OutdatedUpdateSlot,
}
