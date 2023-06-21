use anchor_lang::prelude::*;

#[error_code]
pub enum CloneError {
    /// 0. Invalid Mint Collateral Ratio
    #[msg("Invalid Mint Collateral Ratio")]
    InvalidMintCollateralRatio,

    /// 1. Invalid Comet Collateral Ratio
    #[msg("Invalid Comet Collateral Ratio")]
    InvalidCometCollateralRatio,

    /// 2. Different Scale
    #[msg("Different Scale")]
    DifferentScale,

    /// 3. Math Error
    #[msg("Math Error")]
    MathError,

    /// 4. Oracle Confidence Out Of Range
    #[msg("Oracle Confidence Out Of Range")]
    OracleConfidenceOutOfRange,

    /// 5. Asset Info Not Found
    #[msg("Asset Info Not Found")]
    AssetInfoNotFound,

    /// 6. Collateral Not Found
    #[msg("Collateral Not Found")]
    CollateralNotFound,

    /// 7. Pool Not Found
    #[msg("Pool Not Found")]
    PoolNotFound,

    /// 8. Invalid Collateral Type
    #[msg("Invalid Collateral Type")]
    InvalidCollateralType,

    /// 9. Invalid Token Amount
    #[msg("Invalid Token Amount")]
    InvalidTokenAmount,

    /// 10. Invalid Bool
    #[msg("Invalid Bool")]
    InvalidBool,

    /// 11. Insufficient Collateral
    #[msg("Insufficient Collateral")]
    InsufficientCollateral,

    /// 12. No Price Deviation Detected
    #[msg("No Price Deviation Detected")]
    NoPriceDeviationDetected,

    /// 13. Outdated Oracle
    #[msg("Outdated Oracle")]
    OutdatedOracle,

    /// 14. Comet Already Liquidated
    #[msg("Comet Already Liquidated")]
    CometAlreadyLiquidated,

    /// 15. Comet Not Yet Liquidated
    #[msg("Comet Not Yet Liquidated")]
    CometNotYetLiquidated,

    /// 16. Comet Unable To Liquidate
    #[msg("Comet Unable to Liquidate")]
    CometUnableToLiquidate,

    /// 17. Non Stables not Supported
    #[msg("Non-stables Not Supported")]
    NonStablesNotSupported,

    /// 18. Mint Position Unable To Liquidate
    #[msg("Mint Position Unable to Liquidate")]
    MintPositionUnableToLiquidate,

    /// 19. No Such Collateral Position
    #[msg("No Such Collateral Position")]
    NoSuchCollateralPosition,

    /// 20. Invalid Health Score Coefficient
    #[msg("Invalid Health Score Coefficient")]
    InvalidHealthScoreCoefficient,

    /// 21. Negative Impermanent Loss
    #[msg("Failed Impermanent Loss Calculation")]
    FailedImpermanentLossCalculation,

    /// 22. Health Score Too Low
    #[msg("Health Score Too Low")]
    HealthScoreTooLow,

    /// 23. Insufficient onUSD Collateral
    #[msg("Insufficient onUSD Collateral")]
    InsufficientonUSDCollateral,

    /// 24. Attempted To Add New Pool To Single Comet
    #[msg("Attempted To Add New Pool To Single Comet")]
    AttemptedToAddNewPoolToSingleComet,

    /// 25. Attempted To Add New Collateral To Single Comet
    #[msg("Attempted To Add New Collateral To Single Comet")]
    AttemptedToAddNewCollateralToSingleComet,

    /// 26. Invalid Input Mint Account
    #[msg("Invalid input mint account")]
    InvalidInputMintAccount,

    /// 27. Invalid Input Collateral Account
    #[msg("Invalid input collateral account")]
    InvalidInputCollateralAccount,

    /// 28. Invalid Account Loader Owner
    #[msg("Invalid Account loader owner")]
    InvalidAccountLoaderOwner,

    /// 29. Invalid position index
    #[msg("Invalid input position index")]
    InvalidInputPositionIndex,

    /// 30. Invalid token account balance
    #[msg("Invalid token account balance")]
    InvalidTokenAccountBalance,

    /// 31. Inequality comparison violated
    #[msg("Inequality comparison violated")]
    InequalityComparisonViolated,

    /// 32. Wrong Comet Type
    #[msg("Wrong Comet Type")]
    WrongCometType,

    /// 33. Comet Not Empty
    #[msg("Comet Not Empty")]
    CometNotEmpty,

    /// 34. Liquidity Not Withdrawn
    #[msg("Liquidity Not Withdrawn")]
    LiquidityNotWithdrawn,

    /// 35. Not subject to liquidation
    #[msg("Not Subject to Liquidation")]
    NotSubjectToLiquidation,

    /// 36. Must reduce liquidity first
    #[msg("Not Subject to IL liquidation")]
    NotSubjectToILLiquidation,

    /// 37. Liquidation amount too large
    #[msg("Liquidation amount too large")]
    LiquidationAmountTooLarge,

    /// 38. No remaining account supplied
    #[msg("No remaining accounts supplied")]
    NoRemainingAccountsSupplied,

    /// 39. Invalid Recenter
    #[msg("Invalid Recenter")]
    InvalidRecenter,

    /// 40. Non-zero collateralization ratio required
    #[msg("Non-zero collateralization ratio required")]
    NonZeroCollateralizationRatioRequired,

    /// 41. Incorrect Oracle Address
    #[msg("Incorrect oracle address provided")]
    IncorrectOracleAddress,

    /// 42. Centered Comet Required
    #[msg("Comet must be centered")]
    CenteredCometRequired,

    /// 43. Invalid Resulting Comet
    #[msg("Comet is in an invalid state after action")]
    InvalidResultingComet,

    /// 44. Invalid value range
    #[msg("Value is in an incorrect range")]
    InvalidValueRange,

    /// 45. Invalid value range
    #[msg("Asset stable requirement violated")]
    InvalidAssetStability,

    /// 46. Trade exceeds desired slippage
    #[msg("Slippage tolerance exceeded")]
    SlippageToleranceExceeded,

    /// 47. Position must be empty
    #[msg("Position must be empty")]
    PositionMustBeEmpty,

    /// 48. Collateral must be all in onUSD
    #[msg("Collateral must be all in onUSD")]
    RequireOnlyonUSDCollateral,

    /// 49. Require largest ILD position first
    #[msg("Require largest ILD position first")]
    RequireLargestILDPositionFirst,

    /// 50. Require largest ILD position first
    #[msg("Positions must be all closed")]
    RequireAllPositionsClosed,

    /// 51. Pool ownership exceeding max limit
    #[msg("Pool ownership exceeding max limit")]
    MaxPoolOwnershipExceeded,

    /// 52. Failed to Load Pyth Price Feed
    #[msg("Failed to Load Pyth Price Feed")]
    FailedToLoadPyth,

    /// 53. Pool Deprecated
    #[msg("Pool Deprecated")]
    PoolDeprecated,

    /// 54. Pool is empty
    #[msg("Pool is empty")]
    PoolEmpty,

    /// 55. No liquidity to withdraw
    #[msg("No liquidity to withdraw")]
    NoLiquidityToWithdraw,
}

impl From<CloneError> for ProgramError {
    fn from(e: CloneError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

#[macro_export]
macro_rules! math_error {
    () => {{
        || {
            let error_code = CloneError::MathError;
            msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
            error_code
        }
    }};
}

#[macro_export]
macro_rules! return_error_if_false {
    ($boolean:expr, $err:expr) => {
        if !$boolean {
            return Err(error!($err));
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    pub fn func_with_error() -> Result<()> {
        return_error_if_false!(10 < 2, CloneError::InequalityComparisonViolated);

        Ok(())
    }

    pub fn func_no_error() -> Result<()> {
        return_error_if_false!(10 > 2, CloneError::InequalityComparisonViolated);

        Ok(())
    }

    #[test]
    fn test_return_error_if_false_0() {
        let res = func_with_error();
        assert!(res.is_err());
    }

    #[test]
    fn test_return_error_if_false_1() {
        let res = func_no_error();
        assert!(res.is_ok());
    }
}
