use anchor_lang::prelude::*;

#[error_code]
pub enum CloneError {
    /// 0. Invalid Mint Collateral Ratio
    #[msg("Invalid Mint Collateral Ratio")]
    InvalidMintCollateralRatio,

    /// 1. Collateral Not Found
    #[msg("Collateral Not Found")]
    CollateralNotFound,

    /// 2. Pool Not Found
    #[msg("Pool Not Found")]
    PoolNotFound,

    /// 3. Invalid Collateral Type
    #[msg("Invalid Collateral Type")]
    InvalidCollateralType,

    /// 4. Invalid Token Amount
    #[msg("Invalid Token Amount")]
    InvalidTokenAmount,

    /// 5. Invalid Bool
    #[msg("Invalid Bool")]
    InvalidBool,

    /// 6. Outdated Oracle
    #[msg("Outdated Oracle")]
    OutdatedOracle,

    /// 7. Non Stables not Supported
    #[msg("Non-stables Not Supported")]
    NonStablesNotSupported,

    /// 8. Mint Position Unable To Liquidate
    #[msg("Mint Position Unable to Liquidate")]
    MintPositionUnableToLiquidate,

    /// 9. Health Score Too Low
    #[msg("Health Score Too Low")]
    HealthScoreTooLow,

    /// 10. Invalid Input Collateral Account
    #[msg("Invalid input collateral account")]
    InvalidInputCollateralAccount,

    /// 11. Invalid Account Loader Owner
    #[msg("Invalid Account loader owner")]
    InvalidAccountLoaderOwner,

    /// 12. Invalid position index
    #[msg("Invalid input position index")]
    InvalidInputPositionIndex,

    /// 13. Invalid token account balance
    #[msg("Invalid token account balance")]
    InvalidTokenAccountBalance,

    /// 14. Inequality comparison violated
    #[msg("Inequality comparison violated")]
    InequalityComparisonViolated,

    /// 15. Comet Not Empty
    #[msg("Comet Not Empty")]
    CometNotEmpty,

    /// 16. Not subject to liquidation
    #[msg("Not Subject to Liquidation")]
    NotSubjectToLiquidation,

    /// 17. Liquidation amount too large
    #[msg("Liquidation amount too large")]
    LiquidationAmountTooLarge,

    /// 18. No remaining account supplied
    #[msg("No remaining accounts supplied")]
    NoRemainingAccountsSupplied,

    /// 19. Non-zero collateralization ratio required
    #[msg("Non-zero collateralization ratio required")]
    NonZeroCollateralizationRatioRequired,

    /// 20. Incorrect Oracle Address
    #[msg("Incorrect oracle address provided")]
    IncorrectOracleAddress,

    /// 21. Invalid value range
    #[msg("Value is in an incorrect range")]
    InvalidValueRange,

    /// 22. Invalid asset stability
    #[msg("Asset stable requirement violated")]
    InvalidAssetStability,

    /// 23. Trade exceeds desired slippage
    #[msg("Slippage tolerance exceeded")]
    SlippageToleranceExceeded,

    /// 24. Collateral must be all in onUSD
    #[msg("Collateral must be all in onUSD")]
    RequireOnlyonUSDCollateral,

    /// 25. Require largest ILD position first
    #[msg("Positions must be all closed")]
    RequireAllPositionsClosed,

    /// 26. Failed to Load Pyth Price Feed
    #[msg("Failed to Load Pyth Price Feed")]
    FailedToLoadPyth,

    /// 27. Pool Deprecated
    #[msg("Pool Deprecated")]
    PoolDeprecated,

    /// 28. Pool is empty
    #[msg("Pool is empty")]
    PoolEmpty,

    /// 29. No liquidity to withdraw
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
