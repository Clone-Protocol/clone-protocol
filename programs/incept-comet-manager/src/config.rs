use rust_decimal::prelude::*;

const fn local_testing_value(local_testing_value: u64, production_value: u64) -> u64 {
    if cfg!(feature = "local-testing") {
        local_testing_value
    } else {
        production_value
    }
}

pub const REDEMPTION_TIME_WINDOW: u64 = 259200;
pub const MAX_STRIKES: u64 = 3;
pub const MIN_COLLATERAL_DEPOSIT: Decimal = Decimal::from_parts(10, 0, 0, false, 0); // 10
pub const MIN_TOKEN_WITHDRAWAL: Decimal = Decimal::from_parts(1, 0, 0, false, 0); // 1
pub const TERMINATION_TIMEOUT_SECONDS: u64 = local_testing_value(0, 604800);
pub const FEE_CLAIM_INTERVAL_SECONDS: u64 = local_testing_value(0, 604800);
pub const REPLENISH_STRIKE_INTERVAL_SECONDS: u64 = local_testing_value(0, 604800);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn print_decimal_parts() {
        println!("{:?}", Decimal::new(10, 0).unpack());
    }
}
