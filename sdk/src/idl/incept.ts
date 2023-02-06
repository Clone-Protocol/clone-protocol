export type Incept = {
  "version": "0.1.0",
  "name": "incept",
  "instructions": [
    {
      "name": "initializeManager",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "usdiVault",
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
          "name": "chainlinkProgram",
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
          "name": "ilHealthScoreCoefficient",
          "type": "u64"
        },
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
          "name": "collateralFullLiquidationThreshold",
          "type": "u64"
        },
        {
          "name": "treasuryAddress",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "updateIlHealthScoreCoefficient",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "ilHealthScoreCoefficient",
          "type": "u64"
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
      "name": "initializeMintPositions",
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
          "name": "mintPositions",
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
          "name": "userNonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeLiquidityPositions",
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
          "name": "liquidityPositions",
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
          "name": "userNonce",
          "type": "u8"
        }
      ]
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
          "name": "userNonce",
          "type": "u8"
        },
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
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "scale",
          "type": "u8"
        },
        {
          "name": "stable",
          "type": "u8"
        },
        {
          "name": "collateralizationRatio",
          "type": "u64"
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
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdiTokenAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "iassetTokenAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "liquidationIassetTokenAccount",
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
          "name": "chainlinkOracle",
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
          "name": "healthScoreCoefficient",
          "type": "u64"
        },
        {
          "name": "liquidationDiscountRate",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updatePoolHealthScoreCoefficient",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "healthScoreCoefficient",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updatePrices",
      "accounts": [
        {
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndices",
          "type": {
            "defined": "PoolIndices"
          }
        }
      ]
    },
    {
      "name": "mintUsdi",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeMintPosition",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
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
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "collateralIndex",
          "type": "u8"
        },
        {
          "name": "iassetAmount",
          "type": "u64"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addCollateralToMint",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "mintIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawCollateralFromMint",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "mintIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payBackMint",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "mintIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addIassetToMint",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "mintIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeLiquidityPosition",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "iassetAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "provideLiquidity",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "liquidityPositionIndex",
          "type": "u8"
        },
        {
          "name": "iassetAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawLiquidity",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
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
      "name": "buySynth",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "usdiSpendThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "sellSynth",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryUsdiTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "usdiReceivedThreshold",
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
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
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
          "name": "userNonce",
          "type": "u8"
        },
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
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
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
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
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
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "userNonce",
          "type": "u8"
        },
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
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "userNonce",
          "type": "u8"
        },
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
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "usdiAmount",
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
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "positionIndex",
          "type": "u8"
        },
        {
          "name": "usdiAmount",
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
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "vault",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "cometPositionIndex",
          "type": "u8"
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
        },
        {
          "name": "cometCollateralIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "withdrawLiquidityFromSinglePoolComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAccount",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "vault",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
        },
        {
          "name": "positionIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "recenterComet",
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
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "cometPositionIndex",
          "type": "u8"
        },
        {
          "name": "cometCollateralIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "mintUsdiHackathon",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "liquidateMintPosition",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "mintIndex",
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
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "cometPositionIndex",
          "type": "u8"
        },
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
      "name": "liquidateSinglePoolComet",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiVault",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "positionIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "swapNonstableCollateral",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "userNonce",
          "type": "u8"
        },
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
      "name": "swapStableCollateralIntoUsdi",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiVault",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "cometCollateralIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "liquidateComet",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiVault",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "positionIndex",
          "type": "u8"
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
      "args": [
        {
          "name": "userNonce",
          "type": "u8"
        }
      ]
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
      "args": [
        {
          "name": "userNonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closeMintPositionsAccount",
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
          "name": "mintPositions",
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
      "args": [
        {
          "name": "userNonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closeLiquidityPositionsAccount",
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
          "name": "liquidityPositions",
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
      "args": [
        {
          "name": "userNonce",
          "type": "u8"
        }
      ]
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
      "args": [
        {
          "name": "userNonce",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "manager",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "usdiMint",
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
            "name": "manager",
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
            "name": "chainlinkProgram",
            "type": "publicKey"
          },
          {
            "name": "ilHealthScoreCoefficient",
            "type": {
              "defined": "RawDecimal"
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
            "name": "mintPositions",
            "type": "publicKey"
          },
          {
            "name": "liquidityPositions",
            "type": "publicKey"
          },
          {
            "name": "comet",
            "type": "publicKey"
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
      "name": "liquidityPositions",
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
            "name": "liquidityPositions",
            "type": {
              "array": [
                {
                  "defined": "LiquidityPosition"
                },
                255
              ]
            }
          }
        ]
      }
    },
    {
      "name": "mintPositions",
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
            "name": "mintPositions",
            "type": {
              "array": [
                {
                  "defined": "MintPosition"
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
            "name": "collateralFullLiquidationThreshold",
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
            "name": "iassetMint",
            "type": "publicKey"
          },
          {
            "name": "priceFeedAddresses",
            "type": {
              "array": [
                "publicKey",
                2
              ]
            }
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
            "name": "healthScoreCoefficient",
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
      "name": "Pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "iassetTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "usdiTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "liquidityTokenMint",
            "type": "publicKey"
          },
          {
            "name": "liquidationIassetTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "cometLiquidityTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "iassetAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "usdiAmount",
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
            "name": "vaultUsdiSupply",
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
            "name": "borrowedUsdi",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "borrowedIasset",
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
            "name": "excessTokenTypeIsUsdi",
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
      "name": "LiquidityPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "liquidityTokenValue",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "poolIndex",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "MintPosition",
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
            "name": "borrowedIasset",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
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
      "name": "InsufficientUSDiCollateral",
      "msg": "Insufficient USDi Collateral"
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
      "name": "RequireOnlyUSDiCollateral",
      "msg": "Collateral must be all in USDi"
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
    }
  ]
};

export const IDL: Incept = {
  "version": "0.1.0",
  "name": "incept",
  "instructions": [
    {
      "name": "initializeManager",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "usdiVault",
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
          "name": "chainlinkProgram",
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
          "name": "ilHealthScoreCoefficient",
          "type": "u64"
        },
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
          "name": "collateralFullLiquidationThreshold",
          "type": "u64"
        },
        {
          "name": "treasuryAddress",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "updateIlHealthScoreCoefficient",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "ilHealthScoreCoefficient",
          "type": "u64"
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
      "name": "initializeMintPositions",
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
          "name": "mintPositions",
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
          "name": "userNonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeLiquidityPositions",
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
          "name": "liquidityPositions",
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
          "name": "userNonce",
          "type": "u8"
        }
      ]
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
          "name": "userNonce",
          "type": "u8"
        },
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
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "scale",
          "type": "u8"
        },
        {
          "name": "stable",
          "type": "u8"
        },
        {
          "name": "collateralizationRatio",
          "type": "u64"
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
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdiTokenAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "iassetTokenAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "liquidationIassetTokenAccount",
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
          "name": "chainlinkOracle",
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
          "name": "healthScoreCoefficient",
          "type": "u64"
        },
        {
          "name": "liquidationDiscountRate",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updatePoolHealthScoreCoefficient",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "healthScoreCoefficient",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updatePrices",
      "accounts": [
        {
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndices",
          "type": {
            "defined": "PoolIndices"
          }
        }
      ]
    },
    {
      "name": "mintUsdi",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeMintPosition",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
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
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "collateralIndex",
          "type": "u8"
        },
        {
          "name": "iassetAmount",
          "type": "u64"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addCollateralToMint",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "mintIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawCollateralFromMint",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "mintIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payBackMint",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "mintIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addIassetToMint",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "mintIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeLiquidityPosition",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "iassetAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "provideLiquidity",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "liquidityPositionIndex",
          "type": "u8"
        },
        {
          "name": "iassetAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawLiquidity",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
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
      "name": "buySynth",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "usdiSpendThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "sellSynth",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryUsdiTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "usdiReceivedThreshold",
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
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
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
          "name": "userNonce",
          "type": "u8"
        },
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
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
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
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
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
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "userNonce",
          "type": "u8"
        },
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
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "manager",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "userNonce",
          "type": "u8"
        },
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
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "poolIndex",
          "type": "u8"
        },
        {
          "name": "usdiAmount",
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
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "positionIndex",
          "type": "u8"
        },
        {
          "name": "usdiAmount",
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
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "vault",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "cometPositionIndex",
          "type": "u8"
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
        },
        {
          "name": "cometCollateralIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "withdrawLiquidityFromSinglePoolComet",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAccount",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
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
          "name": "vault",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
        },
        {
          "name": "positionIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "recenterComet",
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
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "cometPositionIndex",
          "type": "u8"
        },
        {
          "name": "cometCollateralIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "mintUsdiHackathon",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdiTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "liquidateMintPosition",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintPositions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorCollateralTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorIassetTokenAccount",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "mintIndex",
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
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "cometPositionIndex",
          "type": "u8"
        },
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
      "name": "liquidateSinglePoolComet",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiVault",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "positionIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "swapNonstableCollateral",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "userNonce",
          "type": "u8"
        },
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
      "name": "swapStableCollateralIntoUsdi",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiVault",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "cometCollateralIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "liquidateComet",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
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
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "cometLiquidityTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiVault",
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
          "name": "userNonce",
          "type": "u8"
        },
        {
          "name": "positionIndex",
          "type": "u8"
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
      "args": [
        {
          "name": "userNonce",
          "type": "u8"
        }
      ]
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
      "args": [
        {
          "name": "userNonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closeMintPositionsAccount",
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
          "name": "mintPositions",
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
      "args": [
        {
          "name": "userNonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closeLiquidityPositionsAccount",
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
          "name": "liquidityPositions",
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
      "args": [
        {
          "name": "userNonce",
          "type": "u8"
        }
      ]
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
      "args": [
        {
          "name": "userNonce",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "manager",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "usdiMint",
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
            "name": "manager",
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
            "name": "chainlinkProgram",
            "type": "publicKey"
          },
          {
            "name": "ilHealthScoreCoefficient",
            "type": {
              "defined": "RawDecimal"
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
            "name": "mintPositions",
            "type": "publicKey"
          },
          {
            "name": "liquidityPositions",
            "type": "publicKey"
          },
          {
            "name": "comet",
            "type": "publicKey"
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
      "name": "liquidityPositions",
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
            "name": "liquidityPositions",
            "type": {
              "array": [
                {
                  "defined": "LiquidityPosition"
                },
                255
              ]
            }
          }
        ]
      }
    },
    {
      "name": "mintPositions",
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
            "name": "mintPositions",
            "type": {
              "array": [
                {
                  "defined": "MintPosition"
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
            "name": "collateralFullLiquidationThreshold",
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
            "name": "iassetMint",
            "type": "publicKey"
          },
          {
            "name": "priceFeedAddresses",
            "type": {
              "array": [
                "publicKey",
                2
              ]
            }
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
            "name": "healthScoreCoefficient",
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
      "name": "Pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "iassetTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "usdiTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "liquidityTokenMint",
            "type": "publicKey"
          },
          {
            "name": "liquidationIassetTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "cometLiquidityTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "iassetAmount",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "usdiAmount",
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
            "name": "vaultUsdiSupply",
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
            "name": "borrowedUsdi",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "borrowedIasset",
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
            "name": "excessTokenTypeIsUsdi",
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
      "name": "LiquidityPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "liquidityTokenValue",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "poolIndex",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "MintPosition",
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
            "name": "borrowedIasset",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
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
      "name": "InsufficientUSDiCollateral",
      "msg": "Insufficient USDi Collateral"
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
      "name": "RequireOnlyUSDiCollateral",
      "msg": "Collateral must be all in USDi"
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
    }
  ]
};
