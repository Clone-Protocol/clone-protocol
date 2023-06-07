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
          "name": "ilHealthScoreCutoff",
          "type": "u64"
        },
        {
          "name": "ilLiquidationRewardPct",
          "type": "u64"
        },
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
        },
        {
          "name": "tokenData",
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
      "args": [
        {
          "name": "isSinglePool",
          "type": "bool"
        }
      ]
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
          "type": "u64"
        },
        {
          "name": "poolIndex",
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
          "name": "pythOracle",
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
          "name": "maxOwnershipPct",
          "type": "u64"
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
          "name": "poolIndices",
          "type": {
            "defined": "PoolIndices"
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
      "name": "provideUnconcentratedLiquidity",
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
          "name": "userLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
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
          "name": "liquidityPositionIndex",
          "type": "u8"
        },
        {
          "name": "onassetAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawUnconcentratedLiquidity",
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
          "name": "userLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
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
          "name": "liquidityPositionIndex",
          "type": "u8"
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "buyOnasset",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryOnassetTokenAccount",
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
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "onusdSpendThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "sellOnasset",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
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
        }
      ],
      "args": [
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "onusdReceivedThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeSinglePoolComet",
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
          "name": "singlePoolComets",
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
          "name": "collateralIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closeSinglePoolComet",
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
          "name": "singlePoolComet",
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
          "name": "cometIndex",
          "type": "u8"
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
      "name": "addCollateralToSinglePoolComet",
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
          "name": "singlePoolComet",
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
          "name": "positionIndex",
          "type": "u8"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawCollateralFromSinglePoolComet",
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
          "name": "positionIndex",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
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
          "name": "onusdAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addLiquidityToSinglePoolComet",
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
          "name": "singlePoolComet",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
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
          "name": "positionIndex",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnusdTokenAccount",
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
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mintOnusdDevnet",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
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
      "name": "payImpermanentLossDebt",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
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
      "name": "liquidateCometNonstableCollateral",
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
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stableCollateralMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stableCollateralVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorStableCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nonstableCollateralMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nonstableCollateralVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorNonstableCollateralTokenAccount",
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
          "name": "stableSwapInAmount",
          "type": "u64"
        },
        {
          "name": "cometNonstableCollateralIndex",
          "type": "u8"
        },
        {
          "name": "cometStableCollateralIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "liquidateCometStableCollateral",
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
          "isMut": false,
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
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdVault",
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
        }
      ]
    },
    {
      "name": "liquidateCometIld",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
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
          "name": "liquidatorOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdVault",
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
      "name": "liquidateCometBorrow",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdVault",
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
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
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
      "name": "closeSinglePoolCometAccount",
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
          "name": "singlePoolComet",
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
            "name": "pools",
            "type": {
              "array": [
                {
                  "defined": "Pool"
                },
                255
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
                255
              ]
            }
          },
          {
            "name": "ilHealthScoreCutoff",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "ilLiquidationRewardPct",
            "type": {
              "defined": "RawDecimal"
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
            "name": "singlePoolComets",
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
            "name": "isSinglePool",
            "type": "u64"
          },
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
                255
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
                255
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
                255
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "PoolIndices",
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
      "name": "Value",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "val",
            "type": "u128"
          },
          {
            "name": "scale",
            "type": "u64"
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
            "name": "twap",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "confidence",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "status",
            "type": "u64"
          },
          {
            "name": "lastUpdate",
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
          },
          {
            "name": "maxOwnershipPct",
            "type": {
              "defined": "RawDecimal"
            }
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
            "name": "onassetTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "onusdTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "liquidityTokenMint",
            "type": "publicKey"
          },
          {
            "name": "underlyingAssetTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "cometLiquidityTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "onassetAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "onusdAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "liquidityTokenSupply",
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
            "name": "poolIndex",
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
            "name": "borrowedOnusd",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "borrowedOnasset",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "liquidityTokenValue",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "cometLiquidation",
            "type": {
              "defined": "CometLiquidation"
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
      "name": "CometLiquidation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "status",
            "type": "u64"
          },
          {
            "name": "excessTokenTypeIsOnusd",
            "type": "u64"
          },
          {
            "name": "excessTokenAmount",
            "type": {
              "defined": "RawDecimal"
            }
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
          },
          {
            "name": "IlHealthScoreCutoff",
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
            "name": "IlLiquidationRewardPct",
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
      "name": "CollateralParameters",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "PoolIndex",
            "fields": [
              {
                "name": "index",
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
            "name": "PythAddress",
            "fields": [
              {
                "name": "address",
                "type": "publicKey"
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
          },
          {
            "name": "MaxOwnershipPct",
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
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "isBuy",
          "type": "bool",
          "index": false
        },
        {
          "name": "onasset",
          "type": "u64",
          "index": false
        },
        {
          "name": "onusd",
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
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "isConcentrated",
          "type": "bool",
          "index": false
        },
        {
          "name": "onassetDelta",
          "type": "i64",
          "index": false
        },
        {
          "name": "onusdDelta",
          "type": "i64",
          "index": false
        },
        {
          "name": "lpTokenDelta",
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
          "name": "onasset",
          "type": "u64",
          "index": false
        },
        {
          "name": "onusd",
          "type": "u64",
          "index": false
        },
        {
          "name": "lpTokens",
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
          "name": "user",
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
      "name": "InvalidCometCollateralRatio",
      "msg": "Invalid Comet Collateral Ratio"
    },
    {
      "code": 6002,
      "name": "DifferentScale",
      "msg": "Different Scale"
    },
    {
      "code": 6003,
      "name": "MathError",
      "msg": "Math Error"
    },
    {
      "code": 6004,
      "name": "OracleConfidenceOutOfRange",
      "msg": "Oracle Confidence Out Of Range"
    },
    {
      "code": 6005,
      "name": "AssetInfoNotFound",
      "msg": "Asset Info Not Found"
    },
    {
      "code": 6006,
      "name": "CollateralNotFound",
      "msg": "Collateral Not Found"
    },
    {
      "code": 6007,
      "name": "PoolNotFound",
      "msg": "Pool Not Found"
    },
    {
      "code": 6008,
      "name": "InvalidCollateralType",
      "msg": "Invalid Collateral Type"
    },
    {
      "code": 6009,
      "name": "InvalidTokenAmount",
      "msg": "Invalid Token Amount"
    },
    {
      "code": 6010,
      "name": "InvalidBool",
      "msg": "Invalid Bool"
    },
    {
      "code": 6011,
      "name": "InsufficientCollateral",
      "msg": "Insufficient Collateral"
    },
    {
      "code": 6012,
      "name": "NoPriceDeviationDetected",
      "msg": "No Price Deviation Detected"
    },
    {
      "code": 6013,
      "name": "OutdatedOracle",
      "msg": "Outdated Oracle"
    },
    {
      "code": 6014,
      "name": "CometAlreadyLiquidated",
      "msg": "Comet Already Liquidated"
    },
    {
      "code": 6015,
      "name": "CometNotYetLiquidated",
      "msg": "Comet Not Yet Liquidated"
    },
    {
      "code": 6016,
      "name": "CometUnableToLiquidate",
      "msg": "Comet Unable to Liquidate"
    },
    {
      "code": 6017,
      "name": "NonStablesNotSupported",
      "msg": "Non-stables Not Supported"
    },
    {
      "code": 6018,
      "name": "MintPositionUnableToLiquidate",
      "msg": "Mint Position Unable to Liquidate"
    },
    {
      "code": 6019,
      "name": "NoSuchCollateralPosition",
      "msg": "No Such Collateral Position"
    },
    {
      "code": 6020,
      "name": "InvalidHealthScoreCoefficient",
      "msg": "Invalid Health Score Coefficient"
    },
    {
      "code": 6021,
      "name": "FailedImpermanentLossCalculation",
      "msg": "Failed Impermanent Loss Calculation"
    },
    {
      "code": 6022,
      "name": "HealthScoreTooLow",
      "msg": "Health Score Too Low"
    },
    {
      "code": 6023,
      "name": "InsufficientonUSDCollateral",
      "msg": "Insufficient onUSD Collateral"
    },
    {
      "code": 6024,
      "name": "AttemptedToAddNewPoolToSingleComet",
      "msg": "Attempted To Add New Pool To Single Comet"
    },
    {
      "code": 6025,
      "name": "AttemptedToAddNewCollateralToSingleComet",
      "msg": "Attempted To Add New Collateral To Single Comet"
    },
    {
      "code": 6026,
      "name": "InvalidInputMintAccount",
      "msg": "Invalid input mint account"
    },
    {
      "code": 6027,
      "name": "InvalidInputCollateralAccount",
      "msg": "Invalid input collateral account"
    },
    {
      "code": 6028,
      "name": "InvalidAccountLoaderOwner",
      "msg": "Invalid Account loader owner"
    },
    {
      "code": 6029,
      "name": "InvalidInputPositionIndex",
      "msg": "Invalid input position index"
    },
    {
      "code": 6030,
      "name": "InvalidTokenAccountBalance",
      "msg": "Invalid token account balance"
    },
    {
      "code": 6031,
      "name": "InequalityComparisonViolated",
      "msg": "Inequality comparison violated"
    },
    {
      "code": 6032,
      "name": "WrongCometType",
      "msg": "Wrong Comet Type"
    },
    {
      "code": 6033,
      "name": "CometNotEmpty",
      "msg": "Comet Not Empty"
    },
    {
      "code": 6034,
      "name": "LiquidityNotWithdrawn",
      "msg": "Liquidity Not Withdrawn"
    },
    {
      "code": 6035,
      "name": "NotSubjectToLiquidation",
      "msg": "Not Subject to Liquidation"
    },
    {
      "code": 6036,
      "name": "NotSubjectToILLiquidation",
      "msg": "Not Subject to IL liquidation"
    },
    {
      "code": 6037,
      "name": "LiquidationAmountTooLarge",
      "msg": "Liquidation amount too large"
    },
    {
      "code": 6038,
      "name": "NoRemainingAccountsSupplied",
      "msg": "No remaining accounts supplied"
    },
    {
      "code": 6039,
      "name": "InvalidRecenter",
      "msg": "Invalid Recenter"
    },
    {
      "code": 6040,
      "name": "NonZeroCollateralizationRatioRequired",
      "msg": "Non-zero collateralization ratio required"
    },
    {
      "code": 6041,
      "name": "IncorrectOracleAddress",
      "msg": "Incorrect oracle address provided"
    },
    {
      "code": 6042,
      "name": "CenteredCometRequired",
      "msg": "Comet must be centered"
    },
    {
      "code": 6043,
      "name": "InvalidResultingComet",
      "msg": "Comet is in an invalid state after action"
    },
    {
      "code": 6044,
      "name": "InvalidValueRange",
      "msg": "Value is in an incorrect range"
    },
    {
      "code": 6045,
      "name": "InvalidAssetStability",
      "msg": "Asset stable requirement violated"
    },
    {
      "code": 6046,
      "name": "SlippageToleranceExceeded",
      "msg": "Slippage tolerance exceeded"
    },
    {
      "code": 6047,
      "name": "PositionMustBeEmpty",
      "msg": "Position must be empty"
    },
    {
      "code": 6048,
      "name": "RequireOnlyonUSDCollateral",
      "msg": "Collateral must be all in onUSD"
    },
    {
      "code": 6049,
      "name": "RequireLargestILDPositionFirst",
      "msg": "Require largest ILD position first"
    },
    {
      "code": 6050,
      "name": "RequireAllPositionsClosed",
      "msg": "Positions must be all closed"
    },
    {
      "code": 6051,
      "name": "MaxPoolOwnershipExceeded",
      "msg": "Pool ownership exceeding max limit"
    },
    {
      "code": 6052,
      "name": "FailedToLoadPyth",
      "msg": "Failed to Load Pyth Price Feed"
    },
    {
      "code": 6053,
      "name": "PoolDeprecated",
      "msg": "Pool Deprecated"
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
          "name": "ilHealthScoreCutoff",
          "type": "u64"
        },
        {
          "name": "ilLiquidationRewardPct",
          "type": "u64"
        },
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
        },
        {
          "name": "tokenData",
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
      "args": [
        {
          "name": "isSinglePool",
          "type": "bool"
        }
      ]
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
          "type": "u64"
        },
        {
          "name": "poolIndex",
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
          "name": "pythOracle",
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
          "name": "maxOwnershipPct",
          "type": "u64"
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
          "name": "poolIndices",
          "type": {
            "defined": "PoolIndices"
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
      "name": "provideUnconcentratedLiquidity",
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
          "name": "userLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
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
          "name": "liquidityPositionIndex",
          "type": "u8"
        },
        {
          "name": "onassetAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawUnconcentratedLiquidity",
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
          "name": "userLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
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
          "name": "liquidityPositionIndex",
          "type": "u8"
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "buyOnasset",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryOnassetTokenAccount",
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
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "onusdSpendThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "sellOnasset",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
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
        }
      ],
      "args": [
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "onusdReceivedThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeSinglePoolComet",
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
          "name": "singlePoolComets",
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
          "name": "collateralIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closeSinglePoolComet",
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
          "name": "singlePoolComet",
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
          "name": "cometIndex",
          "type": "u8"
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
      "name": "addCollateralToSinglePoolComet",
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
          "name": "singlePoolComet",
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
          "name": "positionIndex",
          "type": "u8"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawCollateralFromSinglePoolComet",
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
          "name": "positionIndex",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
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
          "name": "onusdAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addLiquidityToSinglePoolComet",
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
          "name": "singlePoolComet",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
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
          "name": "positionIndex",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userOnusdTokenAccount",
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
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mintOnusdDevnet",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
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
      "name": "payImpermanentLossDebt",
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
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
      "name": "liquidateCometNonstableCollateral",
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
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stableCollateralMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stableCollateralVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorStableCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nonstableCollateralMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nonstableCollateralVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorNonstableCollateralTokenAccount",
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
          "name": "stableSwapInAmount",
          "type": "u64"
        },
        {
          "name": "cometNonstableCollateralIndex",
          "type": "u8"
        },
        {
          "name": "cometStableCollateralIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "liquidateCometStableCollateral",
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
          "isMut": false,
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
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdVault",
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
        }
      ]
    },
    {
      "name": "liquidateCometIld",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
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
          "name": "liquidatorOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdVault",
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
      "name": "liquidateCometBorrow",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
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
          "name": "ammOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorOnassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorOnusdTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "onusdVault",
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
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
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
      "name": "closeSinglePoolCometAccount",
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
          "name": "singlePoolComet",
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
            "name": "pools",
            "type": {
              "array": [
                {
                  "defined": "Pool"
                },
                255
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
                255
              ]
            }
          },
          {
            "name": "ilHealthScoreCutoff",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "ilLiquidationRewardPct",
            "type": {
              "defined": "RawDecimal"
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
            "name": "singlePoolComets",
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
            "name": "isSinglePool",
            "type": "u64"
          },
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
                255
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
                255
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
                255
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "PoolIndices",
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
      "name": "Value",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "val",
            "type": "u128"
          },
          {
            "name": "scale",
            "type": "u64"
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
            "name": "twap",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "confidence",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "status",
            "type": "u64"
          },
          {
            "name": "lastUpdate",
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
          },
          {
            "name": "maxOwnershipPct",
            "type": {
              "defined": "RawDecimal"
            }
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
            "name": "onassetTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "onusdTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "liquidityTokenMint",
            "type": "publicKey"
          },
          {
            "name": "underlyingAssetTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "cometLiquidityTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "onassetAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "onusdAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "liquidityTokenSupply",
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
            "name": "poolIndex",
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
            "name": "borrowedOnusd",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "borrowedOnasset",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "liquidityTokenValue",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "cometLiquidation",
            "type": {
              "defined": "CometLiquidation"
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
      "name": "CometLiquidation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "status",
            "type": "u64"
          },
          {
            "name": "excessTokenTypeIsOnusd",
            "type": "u64"
          },
          {
            "name": "excessTokenAmount",
            "type": {
              "defined": "RawDecimal"
            }
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
          },
          {
            "name": "IlHealthScoreCutoff",
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
            "name": "IlLiquidationRewardPct",
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
      "name": "CollateralParameters",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "PoolIndex",
            "fields": [
              {
                "name": "index",
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
            "name": "PythAddress",
            "fields": [
              {
                "name": "address",
                "type": "publicKey"
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
          },
          {
            "name": "MaxOwnershipPct",
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
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "isBuy",
          "type": "bool",
          "index": false
        },
        {
          "name": "onasset",
          "type": "u64",
          "index": false
        },
        {
          "name": "onusd",
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
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "poolIndex",
          "type": "u8",
          "index": false
        },
        {
          "name": "isConcentrated",
          "type": "bool",
          "index": false
        },
        {
          "name": "onassetDelta",
          "type": "i64",
          "index": false
        },
        {
          "name": "onusdDelta",
          "type": "i64",
          "index": false
        },
        {
          "name": "lpTokenDelta",
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
          "name": "onasset",
          "type": "u64",
          "index": false
        },
        {
          "name": "onusd",
          "type": "u64",
          "index": false
        },
        {
          "name": "lpTokens",
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
          "name": "user",
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
      "name": "InvalidCometCollateralRatio",
      "msg": "Invalid Comet Collateral Ratio"
    },
    {
      "code": 6002,
      "name": "DifferentScale",
      "msg": "Different Scale"
    },
    {
      "code": 6003,
      "name": "MathError",
      "msg": "Math Error"
    },
    {
      "code": 6004,
      "name": "OracleConfidenceOutOfRange",
      "msg": "Oracle Confidence Out Of Range"
    },
    {
      "code": 6005,
      "name": "AssetInfoNotFound",
      "msg": "Asset Info Not Found"
    },
    {
      "code": 6006,
      "name": "CollateralNotFound",
      "msg": "Collateral Not Found"
    },
    {
      "code": 6007,
      "name": "PoolNotFound",
      "msg": "Pool Not Found"
    },
    {
      "code": 6008,
      "name": "InvalidCollateralType",
      "msg": "Invalid Collateral Type"
    },
    {
      "code": 6009,
      "name": "InvalidTokenAmount",
      "msg": "Invalid Token Amount"
    },
    {
      "code": 6010,
      "name": "InvalidBool",
      "msg": "Invalid Bool"
    },
    {
      "code": 6011,
      "name": "InsufficientCollateral",
      "msg": "Insufficient Collateral"
    },
    {
      "code": 6012,
      "name": "NoPriceDeviationDetected",
      "msg": "No Price Deviation Detected"
    },
    {
      "code": 6013,
      "name": "OutdatedOracle",
      "msg": "Outdated Oracle"
    },
    {
      "code": 6014,
      "name": "CometAlreadyLiquidated",
      "msg": "Comet Already Liquidated"
    },
    {
      "code": 6015,
      "name": "CometNotYetLiquidated",
      "msg": "Comet Not Yet Liquidated"
    },
    {
      "code": 6016,
      "name": "CometUnableToLiquidate",
      "msg": "Comet Unable to Liquidate"
    },
    {
      "code": 6017,
      "name": "NonStablesNotSupported",
      "msg": "Non-stables Not Supported"
    },
    {
      "code": 6018,
      "name": "MintPositionUnableToLiquidate",
      "msg": "Mint Position Unable to Liquidate"
    },
    {
      "code": 6019,
      "name": "NoSuchCollateralPosition",
      "msg": "No Such Collateral Position"
    },
    {
      "code": 6020,
      "name": "InvalidHealthScoreCoefficient",
      "msg": "Invalid Health Score Coefficient"
    },
    {
      "code": 6021,
      "name": "FailedImpermanentLossCalculation",
      "msg": "Failed Impermanent Loss Calculation"
    },
    {
      "code": 6022,
      "name": "HealthScoreTooLow",
      "msg": "Health Score Too Low"
    },
    {
      "code": 6023,
      "name": "InsufficientonUSDCollateral",
      "msg": "Insufficient onUSD Collateral"
    },
    {
      "code": 6024,
      "name": "AttemptedToAddNewPoolToSingleComet",
      "msg": "Attempted To Add New Pool To Single Comet"
    },
    {
      "code": 6025,
      "name": "AttemptedToAddNewCollateralToSingleComet",
      "msg": "Attempted To Add New Collateral To Single Comet"
    },
    {
      "code": 6026,
      "name": "InvalidInputMintAccount",
      "msg": "Invalid input mint account"
    },
    {
      "code": 6027,
      "name": "InvalidInputCollateralAccount",
      "msg": "Invalid input collateral account"
    },
    {
      "code": 6028,
      "name": "InvalidAccountLoaderOwner",
      "msg": "Invalid Account loader owner"
    },
    {
      "code": 6029,
      "name": "InvalidInputPositionIndex",
      "msg": "Invalid input position index"
    },
    {
      "code": 6030,
      "name": "InvalidTokenAccountBalance",
      "msg": "Invalid token account balance"
    },
    {
      "code": 6031,
      "name": "InequalityComparisonViolated",
      "msg": "Inequality comparison violated"
    },
    {
      "code": 6032,
      "name": "WrongCometType",
      "msg": "Wrong Comet Type"
    },
    {
      "code": 6033,
      "name": "CometNotEmpty",
      "msg": "Comet Not Empty"
    },
    {
      "code": 6034,
      "name": "LiquidityNotWithdrawn",
      "msg": "Liquidity Not Withdrawn"
    },
    {
      "code": 6035,
      "name": "NotSubjectToLiquidation",
      "msg": "Not Subject to Liquidation"
    },
    {
      "code": 6036,
      "name": "NotSubjectToILLiquidation",
      "msg": "Not Subject to IL liquidation"
    },
    {
      "code": 6037,
      "name": "LiquidationAmountTooLarge",
      "msg": "Liquidation amount too large"
    },
    {
      "code": 6038,
      "name": "NoRemainingAccountsSupplied",
      "msg": "No remaining accounts supplied"
    },
    {
      "code": 6039,
      "name": "InvalidRecenter",
      "msg": "Invalid Recenter"
    },
    {
      "code": 6040,
      "name": "NonZeroCollateralizationRatioRequired",
      "msg": "Non-zero collateralization ratio required"
    },
    {
      "code": 6041,
      "name": "IncorrectOracleAddress",
      "msg": "Incorrect oracle address provided"
    },
    {
      "code": 6042,
      "name": "CenteredCometRequired",
      "msg": "Comet must be centered"
    },
    {
      "code": 6043,
      "name": "InvalidResultingComet",
      "msg": "Comet is in an invalid state after action"
    },
    {
      "code": 6044,
      "name": "InvalidValueRange",
      "msg": "Value is in an incorrect range"
    },
    {
      "code": 6045,
      "name": "InvalidAssetStability",
      "msg": "Asset stable requirement violated"
    },
    {
      "code": 6046,
      "name": "SlippageToleranceExceeded",
      "msg": "Slippage tolerance exceeded"
    },
    {
      "code": 6047,
      "name": "PositionMustBeEmpty",
      "msg": "Position must be empty"
    },
    {
      "code": 6048,
      "name": "RequireOnlyonUSDCollateral",
      "msg": "Collateral must be all in onUSD"
    },
    {
      "code": 6049,
      "name": "RequireLargestILDPositionFirst",
      "msg": "Require largest ILD position first"
    },
    {
      "code": 6050,
      "name": "RequireAllPositionsClosed",
      "msg": "Positions must be all closed"
    },
    {
      "code": 6051,
      "name": "MaxPoolOwnershipExceeded",
      "msg": "Pool ownership exceeding max limit"
    },
    {
      "code": 6052,
      "name": "FailedToLoadPyth",
      "msg": "Failed to Load Pyth Price Feed"
    },
    {
      "code": 6053,
      "name": "PoolDeprecated",
      "msg": "Pool Deprecated"
    }
  ]
};