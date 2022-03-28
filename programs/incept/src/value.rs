use anchor_lang::prelude::*;
use std::convert::TryInto;

use crate::*;

pub const DEVNET_TOKEN_SCALE: u8 = 8;
pub const PERCENT_SCALE: u8 = 2;

impl Value {
    pub fn new(value: u128, scale: u8) -> Self {
        Self {
            val: value,
            scale: scale.try_into().unwrap(),
        }
    }
    pub fn denominator(self) -> u128 {
        10u128.pow(self.scale.try_into().unwrap())
    }
    pub fn to_u64(self) -> u64 {
        self.val.try_into().unwrap()
    }
    pub fn to_scaled_u64(self) -> u64 {
        self.val
            .checked_div(u128::pow(10, self.scale.try_into().unwrap()))
            .unwrap()
            .try_into()
            .unwrap()
    }
    pub fn to_scaled_f64(self) -> f64 {
        (self.val as f64) / (f64::powf(10.0, self.scale as f64))
    }
    pub fn from_percent(percent: u16) -> Self {
        Value::new(percent.into(), PERCENT_SCALE)
    }
    pub fn scale_to(self, new_scale: u8) -> Self {
        if new_scale > self.scale.try_into().unwrap() {
            return Value::new(
                self.val
                    .checked_mul(u128::pow(
                        10,
                        new_scale
                            .checked_sub(self.scale.try_into().unwrap())
                            .unwrap()
                            .into(),
                    ))
                    .unwrap(),
                new_scale,
            );
        } else if self.scale > new_scale.try_into().unwrap() {
            return Value::new(
                self.val
                    .checked_div(u128::pow(
                        10,
                        self.scale
                            .checked_sub(new_scale.try_into().unwrap())
                            .unwrap() as u32,
                    ))
                    .unwrap(),
                new_scale,
            );
        }
        return self;
    }
}

impl Mul<Value> for Value {
    fn mul(self, value: Value) -> Self {
        Self {
            val: self
                .val
                .checked_mul(value.val)
                .unwrap()
                .checked_div(value.denominator())
                .unwrap(),
            scale: self.scale,
        }
    }
}
impl Mul<u128> for Value {
    fn mul(self, value: u128) -> Self {
        Self {
            val: self.val.checked_mul(value).unwrap(),
            scale: self.scale,
        }
    }
}

impl Add<Value> for Value {
    fn add(self, value: Value) -> Result<Self, InceptError> {
        require!(self.scale == value.scale, InceptError::DifferentScale);

        Ok(Self {
            val: self.val.checked_add(value.val).unwrap(),
            scale: self.scale,
        })
    }
}
impl Sub<Value> for Value {
    fn sub(self, value: Value) -> Result<Self, InceptError> {
        require!(self.scale == value.scale, InceptError::DifferentScale);
        Ok(Self {
            val: self.val.checked_sub(value.val).unwrap(),
            scale: self.scale,
        })
    }
}
impl Div<Value> for Value {
    fn div(self, other: Value) -> Self {
        Self {
            val: self
                .val
                .checked_mul(other.denominator())
                .unwrap()
                .checked_div(other.val)
                .unwrap(),
            scale: self.scale,
        }
    }
}

impl PowAccuracy<u128> for Value {
    fn pow_with_accuracy(self, exp: u128) -> Self {
        let one = Value {
            val: self.denominator(),
            scale: self.scale,
        };
        if exp == 0 {
            return one;
        }
        let mut current_exp = exp;
        let mut base = self;
        let mut result = one;

        while current_exp > 0 {
            if current_exp % 2 != 0 {
                result = result.mul(base);
            }
            current_exp /= 2;
            base = base.mul(base);
        }
        return result;
    }
}

impl Sqrt<u128> for Value {
    fn sqrt(self) -> Self {
        let mut scale: u8 = 0;
        let mut x = 100;
        loop {
            if self.val > x {
                scale += 1;
            } else {
                break;
            }
            x = x.checked_mul(100).unwrap();
        }
        let mut y = Value::new(u128::pow(10, DEVNET_TOKEN_SCALE.into()), DEVNET_TOKEN_SCALE);
        loop {
            if self.val < y.val {
                scale += 1;
            } else {
                break;
            }
            y.val = y.val.checked_div(100).unwrap();
        }
        return Value::new(
            ((self.val as f64).sqrt()
                * f64::powi(10.0, DEVNET_TOKEN_SCALE.checked_sub(scale).unwrap().into()))
                as u128,
            DEVNET_TOKEN_SCALE,
        );
    }
}

impl Into<u64> for Value {
    fn into(self) -> u64 {
        self.val.try_into().unwrap()
    }
}
impl Into<u128> for Value {
    fn into(self) -> u128 {
        self.val.try_into().unwrap()
    }
}

impl Compare<Value> for Value {
    fn lte(self, other: Value) -> Result<bool, InceptError> {
        require!(self.scale == other.scale, InceptError::DifferentScale);
        Ok(self.val <= other.val)
    }
    fn lt(self, other: Value) -> Result<bool, InceptError> {
        require!(self.scale == other.scale, InceptError::DifferentScale);
        Ok(self.val < other.val)
    }
    fn gt(self, other: Value) -> Result<bool, InceptError> {
        require!(self.scale == other.scale, InceptError::DifferentScale);
        Ok(self.val > other.val)
    }
    fn gte(self, other: Value) -> Result<bool, InceptError> {
        require!(self.scale == other.scale, InceptError::DifferentScale);
        Ok(self.val >= other.val)
    }
    fn eq(self, other: Value) -> Result<bool, InceptError> {
        require!(self.scale == other.scale, InceptError::DifferentScale);
        Ok(self.val == other.val)
    }
}
pub trait Sub<T>: Sized {
    fn sub(self, rhs: T) -> Result<Self, InceptError>;
}
pub trait Add<T>: Sized {
    fn add(self, rhs: T) -> Result<Self, InceptError>;
}
pub trait Div<T>: Sized {
    fn div(self, rhs: T) -> Self;
}
pub trait DivScale<T> {
    fn div_to_scale(self, rhs: T, to_scale: u8) -> Self;
}
pub trait DivUp<T>: Sized {
    fn div_up(self, rhs: T) -> Self;
}
pub trait Mul<T>: Sized {
    fn mul(self, rhs: T) -> Self;
}
pub trait MulUp<T>: Sized {
    fn mul_up(self, rhs: T) -> Self;
}
pub trait PowAccuracy<T>: Sized {
    fn pow_with_accuracy(self, rhs: T) -> Self;
}
pub trait Sqrt<T>: Sized {
    fn sqrt(self) -> Self;
}
pub trait Compare<T>: Sized {
    fn eq(self, rhs: T) -> Result<bool, InceptError>;
    fn lt(self, rhs: T) -> Result<bool, InceptError>;
    fn gt(self, rhs: T) -> Result<bool, InceptError>;
    fn gte(self, rhs: T) -> Result<bool, InceptError>;
    fn lte(self, rhs: T) -> Result<bool, InceptError>;
}
