export type Clone = {
  "version": "0.1.0",
  "name": "clone",
  "instructions": [
    {
      "name": "initializeClone",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "onusdVault",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcVault",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenData",
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
          "name": "maxHealthLiquidation",
          "type": "u64"
        },
        {
          "name": "liquidatorFee",
          "type": "u64"
        },
        {
          "name": "treasuryAddress",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "updateCloneParameters",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": "CloneParameters"
          }
        }
      ]
    },
    {
      "name": "updatePoolParameters",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "params",
          "type": {
            "defined": "PoolParameters"
          }
        }
      ]
    },
    {
      "name": "updateCollateralParameters",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "params",
          "type": {
            "defined": "CollateralParameters"
          }
        }
      ]
    },
    {
      "name": "initializeUser",
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
          "name": "authority",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "initializeBorrowPositions",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
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
      "args": []
    },
    {
      "name": "initializeComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
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
      "args": []
    },
    {
      "name": "addCollateral",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "collateralMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": true
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
          "name": "scale",
          "type": "u8"
        },
        {
          "name": "stable",
          "type": "bool"
        },
        {
          "name": "collateralizationRatio",
          "type": "u8"
        },
        {
          "name": "oracleInfoIndex",
          "type": "u8"
        },
        {
          "name": "liquidationDiscount",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializePool",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "onusdTokenAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "onassetTokenAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "underlyingAssetMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "underlyingAssetTokenAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "cometLiquidityTokenAccount",
          "isMut": true,
          "isSigner": true
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
          "name": "stableCollateralRatio",
          "type": "u16"
        },
        {
          "name": "cryptoCollateralRatio",
          "type": "u16"
        },
        {
          "name": "liquidityTradingFee",
          "type": "u16"
        },
        {
          "name": "treasuryTradingFee",
          "type": "u16"
        },
        {
          "name": "ilHealthScoreCoefficient",
          "type": "u64"
        },
        {
          "name": "positionHealthScoreCoefficient",
          "type": "u64"
        },
        {
          "name": "liquidationDiscountRate",
          "type": "u64"
        },
        {
          "name": "oracleInfoIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "updatePrices",
      "accounts": [
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "indices",
          "type": {
            "defined": "OracleIndices"
          }
        }
      ]
    },
    {
      "name": "mintOnusd",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
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
      "name": "burnOnusd",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
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
      "name": "initializeBorrowPosition",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "collateralIndex",
          "type": "u8"
        },
        {
          "name": "onassetAmount",
          "type": "u64"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addCollateralToBorrow",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "borrowIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawCollateralFromBorrow",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "borrowIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payBorrowDebt",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "borrowIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "borrowMore",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "borrowIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addCollateralToComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "collateralIndex",
          "type": "u8"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawCollateralFromComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "cometCollateralIndex",
          "type": "u8"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addLiquidityToComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "onusdAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawLiquidityFromComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "cometPositionIndex",
          "type": "u8"
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "liquidateBorrowPosition",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "user",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "borrowIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "collectLpRewards",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "cometPositionIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "payImpermanentLossDebt",
      "accounts": [
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payerOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payerOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "user",
          "type": "publicKey"
        },
        {
          "name": "cometPositionIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "payOnusdDebt",
          "type": "bool"
        }
      ]
    },
    {
      "name": "closeCometAccount",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "closeBorrowPositionsAccount",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "closeUserAccount",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "deprecatePool",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "poolIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "wrapAsset",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "underlyingAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "unwrapOnasset",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "underlyingAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "removeCometPosition",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "cometPositionIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "swap",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "cloneStaking",
          "isMut": false,
          "isSigner": false,
          "isOptional": true
        },
        {
          "name": "userStakingAccount",
          "isMut": false,
          "isSigner": false,
          "isOptional": true
        },
        {
          "name": "cloneStakingProgram",
          "isMut": false,
          "isSigner": false,
          "isOptional": true
        }
      ],
      "args": [
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "quantity",
          "type": "u64"
        },
        {
          "name": "quantityIsInput",
          "type": "bool"
        },
        {
          "name": "quantityIsOnusd",
          "type": "bool"
        },
        {
          "name": "resultThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addOracleFeed",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "pythAddress",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "removeOracleFeed",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "clone",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "onusdMint",
            "type": "publicKey"
          },
          {
            "name": "tokenData",
            "type": "publicKey"
          },
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "liquidationConfig",
            "type": {
              "defined": "LiquidationConfig"
            }
          },
          {
            "name": "treasuryAddress",
            "type": "publicKey"
          },
          {
            "name": "eventCounter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "clone",
            "type": "publicKey"
          },
          {
            "name": "numPools",
            "type": "u64"
          },
          {
            "name": "numCollaterals",
            "type": "u64"
          },
          {
            "name": "numOracles",
            "type": "u64"
          },
          {
            "name": "pools",
            "type": {
              "array": [
                {
                  "defined": "Pool"
                },
                64
              ]
            }
          },
          {
            "name": "collaterals",
            "type": {
              "array": [
                {
                  "defined": "Collateral"
                },
                16
              ]
            }
          },
          {
            "name": "oracles",
            "type": {
              "array": [
                {
                  "defined": "OracleInfo"
                },
                80
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
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "borrowPositions",
            "type": "publicKey"
          },
          {
            "name": "comet",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "comet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "numPositions",
            "type": "u64"
          },
          {
            "name": "numCollaterals",
            "type": "u64"
          },
          {
            "name": "positions",
            "type": {
              "array": [
                {
                  "defined": "CometPosition"
                },
                64
              ]
            }
          },
          {
            "name": "collaterals",
            "type": {
              "array": [
                {
                  "defined": "CometCollateral"
                },
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "borrowPositions",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "numPositions",
            "type": "u64"
          },
          {
            "name": "borrowPositions",
            "type": {
              "array": [
                {
                  "defined": "BorrowPosition"
                },
                24
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "OracleIndices",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "indices",
            "type": {
              "array": [
                "u8",
                128
              ]
            }
          }
        ]
      }
    },
    {
      "name": "RawDecimal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "data",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "LiquidationConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "liquidatorFee",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "maxHealthLiquidation",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    },
    {
      "name": "AssetInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "onassetMint",
            "type": "publicKey"
          },
          {
            "name": "oracleInfoIndex",
            "type": "u64"
          },
          {
            "name": "stableCollateralRatio",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "cryptoCollateralRatio",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "ilHealthScoreCoefficient",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "positionHealthScoreCoefficient",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "liquidationDiscountRate",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    },
    {
      "name": "OracleInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pythAddress",
            "type": "publicKey"
          },
          {
            "name": "price",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "status",
            "type": "u64"
          },
          {
            "name": "lastUpdateSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "underlyingAssetTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "committedOnusdLiquidity",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "onusdIld",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "onassetIld",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "treasuryTradingFee",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "liquidityTradingFee",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "totalMintedAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "suppliedMintCollateralAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "assetInfo",
            "type": {
              "defined": "AssetInfo"
            }
          },
          {
            "name": "deprecated",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Collateral",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oracleInfoIndex",
            "type": "u64"
          },
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "vault",
            "type": "publicKey"
          },
          {
            "name": "vaultOnusdSupply",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "vaultMintSupply",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "vaultCometSupply",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "stable",
            "type": "u64"
          },
          {
            "name": "collateralizationRatio",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "liquidationDiscount",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    },
    {
      "name": "CometPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "poolIndex",
            "type": "u64"
          },
          {
            "name": "committedOnusdLiquidity",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "onusdIldRebate",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "onassetIldRebate",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    },
    {
      "name": "CometCollateral",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "collateralAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "collateralIndex",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "BorrowPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "collateralAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "poolIndex",
            "type": "u64"
          },
          {
            "name": "collateralIndex",
            "type": "u64"
          },
          {
            "name": "borrowedOnasset",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    },
    {
      "name": "CloneParameters",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "LiquidationFee",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "MaxHealthLiquidation",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "TreasuryAddress",
            "fields": [
              {
                "name": "address",
                "type": "publicKey"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "CollateralParameters",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "OracleInfoIndex",
            "fields": [
              {
                "name": "value",
                "type": "u64"
              }
            ]
          },
          {
            "name": "CollateralizationRatio",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "name": "PoolParameters",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "TreasuryTradingFee",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "LiquidityTradingFee",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "OracleInfoIndex",
            "fields": [
              {
                "name": "value",
                "type": "u64"
              }
            ]
          },
          {
            "name": "StableCollateralRatio",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "CryptoCollateralRatio",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "IlHealthScoreCoefficient",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "PositionHealthScoreCoefficient",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "LiquidationDiscountRate",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "SwapEvent",
      "fields": [
        {
          "name": "eventId",
          "type": "u64",
          "index": false
        },
        {
          "name": "userAddress",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "inputIsOnusd",
          "type": "bool",
          "index": false
        },
        {
          "name": "input",
          "type": "u64",
          "index": false
        },
        {
          "name": "output",
          "type": "u64",
          "index": false
        },
        {
          "name": "tradingFee",
          "type": "u64",
          "index": false
        },
        {
          "name": "treasuryFee",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "LiquidityDelta",
      "fields": [
        {
          "name": "eventId",
          "type": "u64",
          "index": false
        },
        {
          "name": "userAddress",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "committedOnusdDelta",
          "type": "i64",
          "index": false
        },
        {
          "name": "onusdIldDelta",
          "type": "i64",
          "index": false
        },
        {
          "name": "onassetIldDelta",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "PoolState",
      "fields": [
        {
          "name": "eventId",
          "type": "u64",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "onassetIld",
          "type": "i64",
          "index": false
        },
        {
          "name": "onusdIld",
          "type": "i64",
          "index": false
        },
        {
          "name": "committedOnusdLiquidity",
          "type": "u64",
          "index": false
        },
        {
          "name": "oraclePrice",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "BorrowUpdate",
      "fields": [
        {
          "name": "eventId",
          "type": "u64",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "userAddress",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "isLiquidation",
          "type": "bool",
          "index": false
        },
        {
          "name": "collateralSupplied",
          "type": "u64",
          "index": false
        },
        {
          "name": "collateralDelta",
          "type": "i64",
          "index": false
        },
        {
          "name": "collateralIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "borrowedAmount",
          "type": "u64",
          "index": false
        },
        {
          "name": "borrowedDelta",
          "type": "i64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidMintCollateralRatio",
      "msg": "Invalid Mint Collateral Ratio"
    },
    {
      "code": 6001,
      "name": "CollateralNotFound",
      "msg": "Collateral Not Found"
    },
    {
      "code": 6002,
      "name": "PoolNotFound",
      "msg": "Pool Not Found"
    },
    {
      "code": 6003,
      "name": "InvalidCollateralType",
      "msg": "Invalid Collateral Type"
    },
    {
      "code": 6004,
      "name": "InvalidTokenAmount",
      "msg": "Invalid Token Amount"
    },
    {
      "code": 6005,
      "name": "InvalidBool",
      "msg": "Invalid Bool"
    },
    {
      "code": 6006,
      "name": "OutdatedOracle",
      "msg": "Outdated Oracle"
    },
    {
      "code": 6007,
      "name": "NonStablesNotSupported",
      "msg": "Non-stables Not Supported"
    },
    {
      "code": 6008,
      "name": "MintPositionUnableToLiquidate",
      "msg": "Mint Position Unable to Liquidate"
    },
    {
      "code": 6009,
      "name": "HealthScoreTooLow",
      "msg": "Health Score Too Low"
    },
    {
      "code": 6010,
      "name": "InvalidInputCollateralAccount",
      "msg": "Invalid input collateral account"
    },
    {
      "code": 6011,
      "name": "InvalidAccountLoaderOwner",
      "msg": "Invalid Account loader owner"
    },
    {
      "code": 6012,
      "name": "InvalidInputPositionIndex",
      "msg": "Invalid input position index"
    },
    {
      "code": 6013,
      "name": "InvalidTokenAccountBalance",
      "msg": "Invalid token account balance"
    },
    {
      "code": 6014,
      "name": "InequalityComparisonViolated",
      "msg": "Inequality comparison violated"
    },
    {
      "code": 6015,
      "name": "CometNotEmpty",
      "msg": "Comet Not Empty"
    },
    {
      "code": 6016,
      "name": "NotSubjectToLiquidation",
      "msg": "Not Subject to Liquidation"
    },
    {
      "code": 6017,
      "name": "LiquidationAmountTooLarge",
      "msg": "Liquidation amount too large"
    },
    {
      "code": 6018,
      "name": "NoRemainingAccountsSupplied",
      "msg": "No remaining accounts supplied"
    },
    {
      "code": 6019,
      "name": "NonZeroCollateralizationRatioRequired",
      "msg": "Non-zero collateralization ratio required"
    },
    {
      "code": 6020,
      "name": "IncorrectOracleAddress",
      "msg": "Incorrect oracle address provided"
    },
    {
      "code": 6021,
      "name": "InvalidValueRange",
      "msg": "Value is in an incorrect range"
    },
    {
      "code": 6022,
      "name": "InvalidAssetStability",
      "msg": "Asset stable requirement violated"
    },
    {
      "code": 6023,
      "name": "SlippageToleranceExceeded",
      "msg": "Slippage tolerance exceeded"
    },
    {
      "code": 6024,
      "name": "RequireOnlyonUSDCollateral",
      "msg": "Collateral must be all in onUSD"
    },
    {
      "code": 6025,
      "name": "RequireAllPositionsClosed",
      "msg": "Positions must be all closed"
    },
    {
      "code": 6026,
      "name": "FailedToLoadPyth",
      "msg": "Failed to Load Pyth Price Feed"
    },
    {
      "code": 6027,
      "name": "PoolDeprecated",
      "msg": "Pool Deprecated"
    },
    {
      "code": 6028,
      "name": "PoolEmpty",
      "msg": "Pool is empty"
    },
    {
      "code": 6029,
      "name": "NoLiquidityToWithdraw",
      "msg": "No liquidity to withdraw"
    },
    {
      "code": 6030,
      "name": "InvalidOracleIndex",
      "msg": "Invalid oracle index"
    }
  ]
};

export const IDL: Clone = {
  "version": "0.1.0",
  "name": "clone",
  "instructions": [
    {
      "name": "initializeClone",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "onusdVault",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcVault",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenData",
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
          "name": "maxHealthLiquidation",
          "type": "u64"
        },
        {
          "name": "liquidatorFee",
          "type": "u64"
        },
        {
          "name": "treasuryAddress",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "updateCloneParameters",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": "CloneParameters"
          }
        }
      ]
    },
    {
      "name": "updatePoolParameters",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "params",
          "type": {
            "defined": "PoolParameters"
          }
        }
      ]
    },
    {
      "name": "updateCollateralParameters",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "params",
          "type": {
            "defined": "CollateralParameters"
          }
        }
      ]
    },
    {
      "name": "initializeUser",
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
          "name": "authority",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "initializeBorrowPositions",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
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
      "args": []
    },
    {
      "name": "initializeComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
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
      "args": []
    },
    {
      "name": "addCollateral",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "collateralMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": true
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
          "name": "scale",
          "type": "u8"
        },
        {
          "name": "stable",
          "type": "bool"
        },
        {
          "name": "collateralizationRatio",
          "type": "u8"
        },
        {
          "name": "oracleInfoIndex",
          "type": "u8"
        },
        {
          "name": "liquidationDiscount",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializePool",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "onusdTokenAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "onassetTokenAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "underlyingAssetMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "underlyingAssetTokenAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "cometLiquidityTokenAccount",
          "isMut": true,
          "isSigner": true
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
          "name": "stableCollateralRatio",
          "type": "u16"
        },
        {
          "name": "cryptoCollateralRatio",
          "type": "u16"
        },
        {
          "name": "liquidityTradingFee",
          "type": "u16"
        },
        {
          "name": "treasuryTradingFee",
          "type": "u16"
        },
        {
          "name": "ilHealthScoreCoefficient",
          "type": "u64"
        },
        {
          "name": "positionHealthScoreCoefficient",
          "type": "u64"
        },
        {
          "name": "liquidationDiscountRate",
          "type": "u64"
        },
        {
          "name": "oracleInfoIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "updatePrices",
      "accounts": [
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "indices",
          "type": {
            "defined": "OracleIndices"
          }
        }
      ]
    },
    {
      "name": "mintOnusd",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
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
      "name": "burnOnusd",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
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
      "name": "initializeBorrowPosition",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "collateralIndex",
          "type": "u8"
        },
        {
          "name": "onassetAmount",
          "type": "u64"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addCollateralToBorrow",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "borrowIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawCollateralFromBorrow",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "borrowIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payBorrowDebt",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "borrowIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "borrowMore",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "borrowIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addCollateralToComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "collateralIndex",
          "type": "u8"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawCollateralFromComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "cometCollateralIndex",
          "type": "u8"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addLiquidityToComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "onusdAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawLiquidityFromComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "cometPositionIndex",
          "type": "u8"
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "liquidateBorrowPosition",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "user",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "borrowIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "collectLpRewards",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "cometPositionIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "payImpermanentLossDebt",
      "accounts": [
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payerOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payerOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "user",
          "type": "publicKey"
        },
        {
          "name": "cometPositionIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "payOnusdDebt",
          "type": "bool"
        }
      ]
    },
    {
      "name": "closeCometAccount",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "closeBorrowPositionsAccount",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "borrowPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "closeUserAccount",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "deprecatePool",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "poolIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "wrapAsset",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "underlyingAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "unwrapOnasset",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "underlyingAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "removeCometPosition",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "cometPositionIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "swap",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "cloneStaking",
          "isMut": false,
          "isSigner": false,
          "isOptional": true
        },
        {
          "name": "userStakingAccount",
          "isMut": false,
          "isSigner": false,
          "isOptional": true
        },
        {
          "name": "cloneStakingProgram",
          "isMut": false,
          "isSigner": false,
          "isOptional": true
        }
      ],
      "args": [
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "quantity",
          "type": "u64"
        },
        {
          "name": "quantityIsInput",
          "type": "bool"
        },
        {
          "name": "quantityIsOnusd",
          "type": "bool"
        },
        {
          "name": "resultThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addOracleFeed",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "pythAddress",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "removeOracleFeed",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "clone",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "clone",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "onusdMint",
            "type": "publicKey"
          },
          {
            "name": "tokenData",
            "type": "publicKey"
          },
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "liquidationConfig",
            "type": {
              "defined": "LiquidationConfig"
            }
          },
          {
            "name": "treasuryAddress",
            "type": "publicKey"
          },
          {
            "name": "eventCounter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "clone",
            "type": "publicKey"
          },
          {
            "name": "numPools",
            "type": "u64"
          },
          {
            "name": "numCollaterals",
            "type": "u64"
          },
          {
            "name": "numOracles",
            "type": "u64"
          },
          {
            "name": "pools",
            "type": {
              "array": [
                {
                  "defined": "Pool"
                },
                64
              ]
            }
          },
          {
            "name": "collaterals",
            "type": {
              "array": [
                {
                  "defined": "Collateral"
                },
                16
              ]
            }
          },
          {
            "name": "oracles",
            "type": {
              "array": [
                {
                  "defined": "OracleInfo"
                },
                80
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
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "borrowPositions",
            "type": "publicKey"
          },
          {
            "name": "comet",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "comet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "numPositions",
            "type": "u64"
          },
          {
            "name": "numCollaterals",
            "type": "u64"
          },
          {
            "name": "positions",
            "type": {
              "array": [
                {
                  "defined": "CometPosition"
                },
                64
              ]
            }
          },
          {
            "name": "collaterals",
            "type": {
              "array": [
                {
                  "defined": "CometCollateral"
                },
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "borrowPositions",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "numPositions",
            "type": "u64"
          },
          {
            "name": "borrowPositions",
            "type": {
              "array": [
                {
                  "defined": "BorrowPosition"
                },
                24
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "OracleIndices",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "indices",
            "type": {
              "array": [
                "u8",
                128
              ]
            }
          }
        ]
      }
    },
    {
      "name": "RawDecimal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "data",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "LiquidationConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "liquidatorFee",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "maxHealthLiquidation",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    },
    {
      "name": "AssetInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "onassetMint",
            "type": "publicKey"
          },
          {
            "name": "oracleInfoIndex",
            "type": "u64"
          },
          {
            "name": "stableCollateralRatio",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "cryptoCollateralRatio",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "ilHealthScoreCoefficient",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "positionHealthScoreCoefficient",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "liquidationDiscountRate",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    },
    {
      "name": "OracleInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pythAddress",
            "type": "publicKey"
          },
          {
            "name": "price",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "status",
            "type": "u64"
          },
          {
            "name": "lastUpdateSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "underlyingAssetTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "committedOnusdLiquidity",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "onusdIld",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "onassetIld",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "treasuryTradingFee",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "liquidityTradingFee",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "totalMintedAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "suppliedMintCollateralAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "assetInfo",
            "type": {
              "defined": "AssetInfo"
            }
          },
          {
            "name": "deprecated",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Collateral",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oracleInfoIndex",
            "type": "u64"
          },
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "vault",
            "type": "publicKey"
          },
          {
            "name": "vaultOnusdSupply",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "vaultMintSupply",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "vaultCometSupply",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "stable",
            "type": "u64"
          },
          {
            "name": "collateralizationRatio",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "liquidationDiscount",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    },
    {
      "name": "CometPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "poolIndex",
            "type": "u64"
          },
          {
            "name": "committedOnusdLiquidity",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "onusdIldRebate",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "onassetIldRebate",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    },
    {
      "name": "CometCollateral",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "collateralAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "collateralIndex",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "BorrowPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "collateralAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "poolIndex",
            "type": "u64"
          },
          {
            "name": "collateralIndex",
            "type": "u64"
          },
          {
            "name": "borrowedOnasset",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    },
    {
      "name": "CloneParameters",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "LiquidationFee",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "MaxHealthLiquidation",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "TreasuryAddress",
            "fields": [
              {
                "name": "address",
                "type": "publicKey"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "CollateralParameters",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "OracleInfoIndex",
            "fields": [
              {
                "name": "value",
                "type": "u64"
              }
            ]
          },
          {
            "name": "CollateralizationRatio",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "name": "PoolParameters",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "TreasuryTradingFee",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "LiquidityTradingFee",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "OracleInfoIndex",
            "fields": [
              {
                "name": "value",
                "type": "u64"
              }
            ]
          },
          {
            "name": "StableCollateralRatio",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "CryptoCollateralRatio",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "IlHealthScoreCoefficient",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "PositionHealthScoreCoefficient",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          },
          {
            "name": "LiquidationDiscountRate",
            "fields": [
              {
                "name": "value",
                "type": {
                  "defined": "RawDecimal"
                }
              }
            ]
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "SwapEvent",
      "fields": [
        {
          "name": "eventId",
          "type": "u64",
          "index": false
        },
        {
          "name": "userAddress",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "inputIsOnusd",
          "type": "bool",
          "index": false
        },
        {
          "name": "input",
          "type": "u64",
          "index": false
        },
        {
          "name": "output",
          "type": "u64",
          "index": false
        },
        {
          "name": "tradingFee",
          "type": "u64",
          "index": false
        },
        {
          "name": "treasuryFee",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "LiquidityDelta",
      "fields": [
        {
          "name": "eventId",
          "type": "u64",
          "index": false
        },
        {
          "name": "userAddress",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "committedOnusdDelta",
          "type": "i64",
          "index": false
        },
        {
          "name": "onusdIldDelta",
          "type": "i64",
          "index": false
        },
        {
          "name": "onassetIldDelta",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "PoolState",
      "fields": [
        {
          "name": "eventId",
          "type": "u64",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "onassetIld",
          "type": "i64",
          "index": false
        },
        {
          "name": "onusdIld",
          "type": "i64",
          "index": false
        },
        {
          "name": "committedOnusdLiquidity",
          "type": "u64",
          "index": false
        },
        {
          "name": "oraclePrice",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "BorrowUpdate",
      "fields": [
        {
          "name": "eventId",
          "type": "u64",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "userAddress",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "isLiquidation",
          "type": "bool",
          "index": false
        },
        {
          "name": "collateralSupplied",
          "type": "u64",
          "index": false
        },
        {
          "name": "collateralDelta",
          "type": "i64",
          "index": false
        },
        {
          "name": "collateralIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "borrowedAmount",
          "type": "u64",
          "index": false
        },
        {
          "name": "borrowedDelta",
          "type": "i64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidMintCollateralRatio",
      "msg": "Invalid Mint Collateral Ratio"
    },
    {
      "code": 6001,
      "name": "CollateralNotFound",
      "msg": "Collateral Not Found"
    },
    {
      "code": 6002,
      "name": "PoolNotFound",
      "msg": "Pool Not Found"
    },
    {
      "code": 6003,
      "name": "InvalidCollateralType",
      "msg": "Invalid Collateral Type"
    },
    {
      "code": 6004,
      "name": "InvalidTokenAmount",
      "msg": "Invalid Token Amount"
    },
    {
      "code": 6005,
      "name": "InvalidBool",
      "msg": "Invalid Bool"
    },
    {
      "code": 6006,
      "name": "OutdatedOracle",
      "msg": "Outdated Oracle"
    },
    {
      "code": 6007,
      "name": "NonStablesNotSupported",
      "msg": "Non-stables Not Supported"
    },
    {
      "code": 6008,
      "name": "MintPositionUnableToLiquidate",
      "msg": "Mint Position Unable to Liquidate"
    },
    {
      "code": 6009,
      "name": "HealthScoreTooLow",
      "msg": "Health Score Too Low"
    },
    {
      "code": 6010,
      "name": "InvalidInputCollateralAccount",
      "msg": "Invalid input collateral account"
    },
    {
      "code": 6011,
      "name": "InvalidAccountLoaderOwner",
      "msg": "Invalid Account loader owner"
    },
    {
      "code": 6012,
      "name": "InvalidInputPositionIndex",
      "msg": "Invalid input position index"
    },
    {
      "code": 6013,
      "name": "InvalidTokenAccountBalance",
      "msg": "Invalid token account balance"
    },
    {
      "code": 6014,
      "name": "InequalityComparisonViolated",
      "msg": "Inequality comparison violated"
    },
    {
      "code": 6015,
      "name": "CometNotEmpty",
      "msg": "Comet Not Empty"
    },
    {
      "code": 6016,
      "name": "NotSubjectToLiquidation",
      "msg": "Not Subject to Liquidation"
    },
    {
      "code": 6017,
      "name": "LiquidationAmountTooLarge",
      "msg": "Liquidation amount too large"
    },
    {
      "code": 6018,
      "name": "NoRemainingAccountsSupplied",
      "msg": "No remaining accounts supplied"
    },
    {
      "code": 6019,
      "name": "NonZeroCollateralizationRatioRequired",
      "msg": "Non-zero collateralization ratio required"
    },
    {
      "code": 6020,
      "name": "IncorrectOracleAddress",
      "msg": "Incorrect oracle address provided"
    },
    {
      "code": 6021,
      "name": "InvalidValueRange",
      "msg": "Value is in an incorrect range"
    },
    {
      "code": 6022,
      "name": "InvalidAssetStability",
      "msg": "Asset stable requirement violated"
    },
    {
      "code": 6023,
      "name": "SlippageToleranceExceeded",
      "msg": "Slippage tolerance exceeded"
    },
    {
      "code": 6024,
      "name": "RequireOnlyonUSDCollateral",
      "msg": "Collateral must be all in onUSD"
    },
    {
      "code": 6025,
      "name": "RequireAllPositionsClosed",
      "msg": "Positions must be all closed"
    },
    {
      "code": 6026,
      "name": "FailedToLoadPyth",
      "msg": "Failed to Load Pyth Price Feed"
    },
    {
      "code": 6027,
      "name": "PoolDeprecated",
      "msg": "Pool Deprecated"
    },
    {
      "code": 6028,
      "name": "PoolEmpty",
      "msg": "Pool is empty"
    },
    {
      "code": 6029,
      "name": "NoLiquidityToWithdraw",
      "msg": "No liquidity to withdraw"
    },
    {
      "code": 6030,
      "name": "InvalidOracleIndex",
      "msg": "Invalid oracle index"
    }
  ]
};
