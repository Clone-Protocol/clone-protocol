export type CloneStaking = {
  "version": "0.1.0",
  "name": "clone_staking",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "cloneStaking",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "clnTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clnTokenVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "stakingPeriodSlots",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addStake",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cloneStaking",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clnTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clnTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userClnTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawStake",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cloneStaking",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clnTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clnTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userClnTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateStakingParams",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "cloneStaking",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": "Parameters"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "cloneStaking",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "clnTokenMint",
            "type": "publicKey"
          },
          {
            "name": "clnTokenVault",
            "type": "publicKey"
          },
          {
            "name": "stakingPeriodSlots",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "numTiers",
            "type": "u8"
          },
          {
            "name": "tiers",
            "type": {
              "array": [
                {
                  "defined": "Tier"
                },
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "user",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stakedTokens",
            "type": "u64"
          },
          {
            "name": "minSlotWithdrawal",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Tier",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stakeRequirement",
            "type": "u64"
          },
          {
            "name": "lpTradingFeeBps",
            "type": "u16"
          },
          {
            "name": "treasuryTradingFeeBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "Parameters",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Staking",
            "fields": [
              {
                "name": "staking_period_slots",
                "type": "u64"
              }
            ]
          },
          {
            "name": "Tier",
            "fields": [
              {
                "name": "num_tiers",
                "type": "u8"
              },
              {
                "name": "index",
                "type": "u8"
              },
              {
                "name": "stake_requirement",
                "type": "u64"
              },
              {
                "name": "lp_trading_fee_bps",
                "type": "u16"
              },
              {
                "name": "treasury_trading_fee_bps",
                "type": "u16"
              }
            ]
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "CannotWithdrawBeforeStakingPeriod",
      "msg": "Cannot withdraw before the staking period ends!"
    },
    {
      "code": 6001,
      "name": "InvalidInput",
      "msg": "Input is invalid!"
    }
  ]
};

export const IDL: CloneStaking = {
  "version": "0.1.0",
  "name": "clone_staking",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "cloneStaking",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "clnTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clnTokenVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "stakingPeriodSlots",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addStake",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cloneStaking",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clnTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clnTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userClnTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawStake",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cloneStaking",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clnTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clnTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userClnTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateStakingParams",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "cloneStaking",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": "Parameters"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "cloneStaking",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "clnTokenMint",
            "type": "publicKey"
          },
          {
            "name": "clnTokenVault",
            "type": "publicKey"
          },
          {
            "name": "stakingPeriodSlots",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "numTiers",
            "type": "u8"
          },
          {
            "name": "tiers",
            "type": {
              "array": [
                {
                  "defined": "Tier"
                },
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "user",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stakedTokens",
            "type": "u64"
          },
          {
            "name": "minSlotWithdrawal",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Tier",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stakeRequirement",
            "type": "u64"
          },
          {
            "name": "lpTradingFeeBps",
            "type": "u16"
          },
          {
            "name": "treasuryTradingFeeBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "Parameters",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Staking",
            "fields": [
              {
                "name": "staking_period_slots",
                "type": "u64"
              }
            ]
          },
          {
            "name": "Tier",
            "fields": [
              {
                "name": "num_tiers",
                "type": "u8"
              },
              {
                "name": "index",
                "type": "u8"
              },
              {
                "name": "stake_requirement",
                "type": "u64"
              },
              {
                "name": "lp_trading_fee_bps",
                "type": "u16"
              },
              {
                "name": "treasury_trading_fee_bps",
                "type": "u16"
              }
            ]
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "CannotWithdrawBeforeStakingPeriod",
      "msg": "Cannot withdraw before the staking period ends!"
    },
    {
      "code": 6001,
      "name": "InvalidInput",
      "msg": "Input is invalid!"
    }
  ]
};
