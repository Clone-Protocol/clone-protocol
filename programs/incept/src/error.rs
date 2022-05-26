use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum InceptError {
    /// Invalid Mint Collateral Ratio
    #[error("Invalid Mint Collateral Ratio")]
    InvalidMintCollateralRatio,

    /// Invalid Comet Collateral Ratio
    #[error("Invalid Comet Collateral Ratio")]
    InvalidCometCollateralRatio,

    /// Different Scale
    #[error("Different Scale")]
    DifferentScale,

    /// Math Error
    #[error("Math Error")]
    MathError,

    /// Oracle Confidence Out Of Range
    #[error("Oracle Confidence Out Of Range")]
    OracleConfidenceOutOfRange,

    /// Asset Info Not Found
    #[error("Asset Info Not Found")]
    AssetInfoNotFound,

    /// Collateral Not Found
    #[error("Collateral Not Found")]
    CollateralNotFound,

    /// Pool Not Found
    #[error("Pool Not Found")]
    PoolNotFound,

    /// Invalid Collateral Type
    #[error("Invalid Collateral Type")]
    InvalidCollateralType,

    /// Invalid Token Amount
    #[error("Invalid Token Amount")]
    InvalidTokenAmount,

    /// Invalid Bool
    #[error("Invalid Bool")]
    InvalidBool,

    /// Insufficient Collateral
    #[error("Insufficient Collateral")]
    InsufficientCollateral,

    /// No Price Deviation Detected
    #[error("No Price Deviation Detected")]
    NoPriceDeviationDetected,

    /// Outdated Oracle
    #[error("Outdated Oracle")]
    OutdatedOracle,

    /// Comet Already Liquidated
    #[error("Comet Already Liquidated")]
    CometAlreadyLiquidated,

    /// Comet Not Yet Liquidated
    #[error("Comet Not Yet Liquidated")]
    CometNotYetLiquidated,

    /// Comet Unable To Liquidate
    #[error("Comet Unable to Liquidate")]
    CometUnableToLiquidate,

    /// Non Stables not Supported
    #[error("Non-stables Not Supported")]
    NonStablesNotSupported,

    /// Mint Position Unable To Liquidate
    #[error("Mint Position Unable to Liquidate")]
    MintPositionUnableToLiquidate,

    /// No Such Collateral Position
    #[error("No Such Collateral Position")]
    NoSuchCollateralPosition,

    /// Invalid Health Score Coefficient
    #[error("Invalid Health Score Coefficient")]
    InvalidHealthScoreCoefficient,

    /// Negative Impermanent Loss
    #[error("Failed Impermanent Loss Calculation")]
    FailedImpermanentLossCalculation,

    /// Health Score Too Low
    #[error("Health Score Too Low")]
    HealthScoreTooLow,
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
