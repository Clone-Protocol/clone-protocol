use anchor_lang::prelude::*;

#[account]
pub struct PositionManager {
    pub account_seeds: Vec<u8>,
}

#[account]
pub struct CometOwner {}
