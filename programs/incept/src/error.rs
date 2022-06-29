use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum InceptError {
    /// 0. Invalid Mint Collateral Ratio
    #[error("Invalid Mint Collateral Ratio")]
    InvalidMintCollateralRatio,

    /// 1. Invalid Comet Collateral Ratio
    #[error("Invalid Comet Collateral Ratio")]
    InvalidCometCollateralRatio,

    /// 2. Different Scale
    #[error("Different Scale")]
    DifferentScale,

    /// 3. Math Error
    #[error("Math Error")]
    MathError,

    /// 4. Oracle Confidence Out Of Range
    #[error("Oracle Confidence Out Of Range")]
    OracleConfidenceOutOfRange,

    /// 5. Asset Info Not Found
    #[error("Asset Info Not Found")]
    AssetInfoNotFound,

    /// 6. Collateral Not Found
    #[error("Collateral Not Found")]
    CollateralNotFound,

    /// 7. Pool Not Found
    #[error("Pool Not Found")]
    PoolNotFound,

    /// 8. Invalid Collateral Type
    #[error("Invalid Collateral Type")]
    InvalidCollateralType,

    /// 9. Invalid Token Amount
    #[error("Invalid Token Amount")]
    InvalidTokenAmount,

    /// 10. Invalid Bool
    #[error("Invalid Bool")]
    InvalidBool,

    /// 11. Insufficient Collateral
    #[error("Insufficient Collateral")]
    InsufficientCollateral,

    /// 12. No Price Deviation Detected
    #[error("No Price Deviation Detected")]
    NoPriceDeviationDetected,

    /// 13. Outdated Oracle
    #[error("Outdated Oracle")]
    OutdatedOracle,

    /// 14. Comet Already Liquidated
    #[error("Comet Already Liquidated")]
    CometAlreadyLiquidated,

    /// 15. Comet Not Yet Liquidated
    #[error("Comet Not Yet Liquidated")]
    CometNotYetLiquidated,

    /// 16. Comet Unable To Liquidate
    #[error("Comet Unable to Liquidate")]
    CometUnableToLiquidate,

    /// 17. Non Stables not Supported
    #[error("Non-stables Not Supported")]
    NonStablesNotSupported,

    /// 18. Mint Position Unable To Liquidate
    #[error("Mint Position Unable to Liquidate")]
    MintPositionUnableToLiquidate,

    /// 19. No Such Collateral Position
    #[error("No Such Collateral Position")]
    NoSuchCollateralPosition,

    /// 20. Invalid Health Score Coefficient
    #[error("Invalid Health Score Coefficient")]
    InvalidHealthScoreCoefficient,

    /// 21. Negative Impermanent Loss
    #[error("Failed Impermanent Loss Calculation")]
    FailedImpermanentLossCalculation,

    /// 22. Health Score Too Low
    #[error("Health Score Too Low")]
    HealthScoreTooLow,

    /// 23. Insufficient USDi Collateral
    #[error("Insufficient USDi Collateral")]
    InsufficientUSDiCollateral,

    /// 24. Attempted To Add New Pool To Single Comet
    #[error("Attempted To Add New Pool To Single Comet")]
    AttemptedToAddNewPoolToSingleComet,

    /// 25. Attempted To Add New Collateral To Single Comet
    #[error("Attempted To Add New Collateral To Single Comet")]
    AttemptedToAddNewCollateralToSingleComet,

    /// 26. Invalid Input Mint Account
    #[error("Invalid input mint account")]
    InvalidInputMintAccount,

    /// 27. Invalid Input Collateral Account
    #[error("Invalid input collateral account")]
    InvalidInputCollateralAccount,

    /// 28. Invalid Account Loader Owner
    #[error("Invalid Account loader owner")]
    InvalidAccountLoaderOwner,

    /// 29. Invalid position index
    #[error("Invalid input position index")]
    InvalidInputPositionIndex,

    /// 30. Invalid token account balance
    #[error("Invalid token account balance")]
    InvalidTokenAccountBalance,

    /// 31. Inequality comparison violated
    #[error("Inequality comparison violated")]
    InequalityComparisonViolated,

    /// 32. Not Single Pool Comet
    #[error("Not Single Pool Comet")]
    NotSinglePoolComet,

    /// 33. Not subject to liquidation
    #[error("Not Subject to Liquidation")]
    NotSubjectToLiquidation,

    /// 34. Must reduce liquidity first
    #[error("Not Subject to IL liquidation")]
    NotSubjectToILLiquidation,

    /// 35. Liquidation amount too large
    #[error("Liquidation amount too large")]
    LiquidationAmountTooLarge,

    /// 36. No remaining account supplied
    #[error("No remaining accounts supplied")]
    NoRemainingAccountsSupplied
}

impl From<InceptError> for ProgramError {
    fn from(e: InceptError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

#[macro_export]
macro_rules! math_error {
    () => {{
        || {
            let error_code = InceptError::MathError;
            msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
            error_code
        }
    }};
}
