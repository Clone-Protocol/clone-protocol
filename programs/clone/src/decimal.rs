use rust_decimal::prelude::*;

pub static CLONE_TOKEN_SCALE: u32 = 8;
pub static PERCENT_SCALE: u32 = 2;
pub static RATIO_SCALE: u32 = 2;
pub static BPS_SCALE: u32 = 4;

#[macro_export]
macro_rules! to_clone_decimal {
    ($e:expr) => {{
        use rust_decimal::Decimal;
        use $crate::decimal::CLONE_TOKEN_SCALE;
        Decimal::new($e as i64, CLONE_TOKEN_SCALE)
    }};
}

#[macro_export]
macro_rules! to_pct_decimal {
    ($e:expr) => {{
        use rust_decimal::Decimal;
        use $crate::decimal::PERCENT_SCALE;
        Decimal::new($e as i64, PERCENT_SCALE)
    }};
}

#[macro_export]
macro_rules! to_ratio_decimal {
    ($e:expr) => {{
        use rust_decimal::Decimal;
        use $crate::decimal::RATIO_SCALE;
        Decimal::new($e as i64, RATIO_SCALE)
    }};
}

#[macro_export]
macro_rules! to_bps_decimal {
    ($e:expr) => {{
        use rust_decimal::Decimal;
        use $crate::decimal::BPS_SCALE;
        Decimal::new($e as i64, BPS_SCALE)
    }};
}

pub fn rescale_toward_zero(decimal: Decimal, scale: u32) -> Decimal {
    let mut rounded_decimal = decimal.round_dp_with_strategy(scale, RoundingStrategy::ToZero);
    rounded_decimal.rescale(scale);
    rounded_decimal
}
