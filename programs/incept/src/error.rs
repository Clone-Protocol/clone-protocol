use anchor_lang::prelude::*;

#[error_code]
pub enum InceptError {
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

    /// 23. Insufficient USDi Collateral
    #[msg("Insufficient USDi Collateral")]
    InsufficientUSDiCollateral,

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

    /// 32. Not Single Pool Comet
    #[msg("Not Single Pool Comet")]
    NotSinglePoolComet,

    /// 33. Single Pool Comet Not Empty
    #[msg("Single Pool Comet Not Empty")]
    SinglePoolCometNotEmpty,

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
    #[msg("Comet must be centered!")]
    CenteredCometRequired,

    /// 43. Invalid Resulting Comet
    #[msg("Comet is in an invalid state after action")]
    InvalidResultingComet,
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
