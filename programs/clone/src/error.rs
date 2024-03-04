use anchor_lang::prelude::*;

#[error_code]
pub enum CloneError {
    /// 0. Unauthorized
    #[msg("Unauthorized")]
    Unauthorized,

    /// 1. Invalid Mint Collateral Ratio
    #[msg("Invalid Mint Collateral Ratio")]
    InvalidMintCollateralRatio,

    /// 2. Integer Type Conversion Error
    #[msg("Integer Type Conversion Error")]
    IntTypeConversionError,

    /// 3. Pool Not Found
    #[msg("Pool Not Found")]
    PoolNotFound,

    /// 4. Bump not found
    #[msg("Bump not found")]
    BumpNotFound,

    /// 5. Invalid Token Amount
    #[msg("Invalid Token Amount")]
    InvalidTokenAmount,

    /// 6. Expected Account Not Found
    #[msg("Expected Account Not Found")]
    ExpectedAccountNotFound,

    /// 7. Outdated Oracle
    #[msg("Outdated Oracle")]
    OutdatedOracle,

    /// 8. Checked Math Error
    #[msg("Checked Math Error")]
    CheckedMathError,

    /// 9. Mint Position Unable To Liquidate
    #[msg("Mint Position Unable to Liquidate")]
    BorrowPositionUnableToLiquidate,

    /// 10. Health Score Too Low
    #[msg("Health Score Too Low")]
    HealthScoreTooLow,

    /// 11. Invalid Input Collateral Account
    #[msg("Invalid input collateral account")]
    InvalidInputCollateralAccount,

    /// 12. Invalid Account Loader Owner
    #[msg("Invalid Account loader owner")]
    InvalidAccountLoaderOwner,

    /// 13. Invalid position index
    #[msg("Invalid input position index")]
    InvalidInputPositionIndex,

    /// 14. Invalid token account balance
    #[msg("Invalid token account balance")]
    InvalidTokenAccountBalance,

    /// 15. Inequality comparison violated
    #[msg("Inequality comparison violated")]
    InequalityComparisonViolated,

    /// 16. Comet Not Empty
    #[msg("Comet Not Empty")]
    CometNotEmpty,

    /// 17. Not subject to liquidation
    #[msg("Not Subject to Liquidation")]
    NotSubjectToLiquidation,

    /// 18. Liquidation amount too large
    #[msg("Liquidation amount too large")]
    LiquidationAmountTooLarge,

    /// 19. No remaining account supplied
    #[msg("No remaining accounts supplied")]
    NoRemainingAccountsSupplied,

    /// 20. Invalid over-collateralization ratios
    #[msg("Invalid over-collateralization ratios")]
    InvalidOvercollateralizationRatios,

    /// 21. Incorrect Oracle Address
    #[msg("Incorrect oracle address provided")]
    IncorrectOracleAddress,

    /// 22. Invalid value range
    #[msg("Value is in an incorrect range")]
    InvalidValueRange,

    /// 23. Invalid asset stability
    #[msg("Asset stable requirement violated")]
    InvalidAssetStability,

    /// 24. Trade exceeds desired slippage
    #[msg("Slippage tolerance exceeded")]
    SlippageToleranceExceeded,

    /// 25. Collateral must be all in onUSD
    #[msg("Collateral must be all in onUSD")]
    RequireOnlyonUSDCollateral,

    /// 26. Require largest ILD position first
    #[msg("Positions must be all closed")]
    RequireAllPositionsClosed,

    /// 27. Failed to Load Pyth Price Feed
    #[msg("Failed to Load Pyth Price Feed")]
    FailedToLoadPyth,

    /// 28. Status Prevents Action
    #[msg("Status Prevents Action")]
    StatusPreventsAction,

    /// 29. Pool is empty
    #[msg("Pool is empty")]
    PoolEmpty,

    /// 30. No liquidity to withdraw
    #[msg("No liquidity to withdraw")]
    NoLiquidityToWithdraw,

    /// 31. Invalid Status
    #[msg("Invalid Status")]
    InvalidStatus,

    /// 32. Auth Array Full
    #[msg("Auth Array Full")]
    AuthArrayFull,

    /// 33. Auth Not Found
    #[msg("Auth Not Found")]
    AuthNotFound,

    /// 34. Invalid oracle index
    #[msg("Invalid oracle index")]
    InvalidOracleIndex,

    /// 35. Invalid Payment Type
    #[msg("Invalid Payment Type")]
    InvalidPaymentType,

    /// 36. Invalid Conversion
    #[msg("Invalid Conversion")]
    InvalidConversion,

    /// 37. Auth already exists
    #[msg("Auth Already Exists")]
    AuthAlreadyExists,

    /// 37. Failed to load Switchboard
    #[msg("Failed to load Switchboard")]
    FailedToLoadSwitchboard,
}

impl From<CloneError> for ProgramError {
    fn from(e: CloneError) -> Self {
        ProgramError::Custom(e as u32)
    }
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
