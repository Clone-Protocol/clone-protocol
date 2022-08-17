export type Incept = {
  "version": "0.1.0",
  "name": "incept",
  "instructions": [
    {
      "name": "initializeManager",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
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
          "name": "managerNonce",
          "type": "u8"
        },
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
          "isMut": false,
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
          "name": "userNonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeSinglePoolComets",
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
          "name": "singlePoolComets",
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
        }
      ]
    },
    {
      "name": "addCollateral",
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
          "name": "managerNonce",
          "type": "u8"
        },
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
          "name": "healthScoreCoefficient",
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
        },
        {
          "name": "chainlinkProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "managerNonce",
          "type": "u8"
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
          "name": "oracle",
          "isMut": false,
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
          "name": "poolIndex",
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
          "name": "singlePoolComets",
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
      "name": "initializeCometManager",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "cometManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "membershipTokenMint",
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
          "name": "userNonce",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
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
          "name": "mintIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "liquidateCometPositionReduction",
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
          "name": "liquidatorIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorUsdiTokenAccount",
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
          "name": "lpTokenReduction",
          "type": "u64"
        }
      ]
    },
    {
      "name": "liquidateCometIlReduction",
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
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "jupiterProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "jupiterAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pythOracle",
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
          "name": "jupiterNonce",
          "type": "u8"
        },
        {
          "name": "positionIndex",
          "type": "u8"
        },
        {
          "name": "assetIndex",
          "type": "u8"
        },
        {
          "name": "cometCollateralIndex",
          "type": "u8"
        },
        {
          "name": "ilReductionAmount",
          "type": "u64"
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
            "name": "isManager",
            "type": "u64"
          },
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
          },
          {
            "name": "cometManager",
            "type": {
              "defined": "CometManager"
            }
          }
        ]
      }
    },
    {
      "name": "singlePoolComets",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "numComets",
            "type": "u64"
          },
          {
            "name": "comets",
            "type": {
              "array": [
                "publicKey",
                255
              ]
            }
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
      "name": "CometManager",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "membershipTokenMint",
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
    },
    {
      "name": "InceptError",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "InvalidMintCollateralRatio"
          },
          {
            "name": "InvalidCometCollateralRatio"
          },
          {
            "name": "DifferentScale"
          },
          {
            "name": "MathError"
          },
          {
            "name": "OracleConfidenceOutOfRange"
          },
          {
            "name": "AssetInfoNotFound"
          },
          {
            "name": "CollateralNotFound"
          },
          {
            "name": "PoolNotFound"
          },
          {
            "name": "InvalidCollateralType"
          },
          {
            "name": "InvalidTokenAmount"
          },
          {
            "name": "InvalidBool"
          },
          {
            "name": "InsufficientCollateral"
          },
          {
            "name": "NoPriceDeviationDetected"
          },
          {
            "name": "OutdatedOracle"
          },
          {
            "name": "CometAlreadyLiquidated"
          },
          {
            "name": "CometNotYetLiquidated"
          },
          {
            "name": "CometUnableToLiquidate"
          },
          {
            "name": "NonStablesNotSupported"
          },
          {
            "name": "MintPositionUnableToLiquidate"
          },
          {
            "name": "NoSuchCollateralPosition"
          },
          {
            "name": "InvalidHealthScoreCoefficient"
          },
          {
            "name": "FailedImpermanentLossCalculation"
          },
          {
            "name": "HealthScoreTooLow"
          },
          {
            "name": "InsufficientUSDiCollateral"
          },
          {
            "name": "AttemptedToAddNewPoolToSingleComet"
          },
          {
            "name": "AttemptedToAddNewCollateralToSingleComet"
          },
          {
            "name": "InvalidInputMintAccount"
          },
          {
            "name": "InvalidInputCollateralAccount"
          },
          {
            "name": "InvalidAccountLoaderOwner"
          },
          {
            "name": "InvalidInputPositionIndex"
          },
          {
            "name": "InvalidTokenAccountBalance"
          },
          {
            "name": "InequalityComparisonViolated"
          },
          {
            "name": "NotSinglePoolComet"
          },
          {
            "name": "SinglePoolCometNotEmpty"
          },
          {
            "name": "LiquidityNotWithdrawn"
          },
          {
            "name": "NotSubjectToLiquidation"
          },
          {
            "name": "NotSubjectToILLiquidation"
          },
          {
            "name": "LiquidationAmountTooLarge"
          },
          {
            "name": "NoRemainingAccountsSupplied"
          },
          {
            "name": "InvalidRecenter"
          },
          {
            "name": "NonZeroCollateralizationRatioRequired"
          }
        ]
      }
    },
    {
      "name": "HealthScore",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Healthy",
            "fields": [
              {
                "name": "score",
                "type": {
                  "defined": "f64"
                }
              }
            ]
          },
          {
            "name": "SubjectToLiquidation",
            "fields": [
              {
                "name": "score",
                "type": {
                  "defined": "f64"
                }
              }
            ]
          }
        ]
      }
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
          "isMut": false,
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
          "name": "managerNonce",
          "type": "u8"
        },
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
          "isMut": false,
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
          "name": "userNonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeSinglePoolComets",
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
          "name": "singlePoolComets",
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
        }
      ]
    },
    {
      "name": "addCollateral",
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
          "name": "managerNonce",
          "type": "u8"
        },
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
          "name": "healthScoreCoefficient",
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
        },
        {
          "name": "chainlinkProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "managerNonce",
          "type": "u8"
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
          "name": "oracle",
          "isMut": false,
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
          "name": "poolIndex",
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
          "name": "singlePoolComets",
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
      "name": "initializeCometManager",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "manager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "cometManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "membershipTokenMint",
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
          "name": "userNonce",
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
          "name": "managerNonce",
          "type": "u8"
        },
        {
          "name": "liquidityTokenAmount",
          "type": "u64"
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
          "name": "mintIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "liquidateCometPositionReduction",
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
          "name": "liquidatorIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidatorUsdiTokenAccount",
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
          "name": "lpTokenReduction",
          "type": "u64"
        }
      ]
    },
    {
      "name": "liquidateCometIlReduction",
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
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "jupiterProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "jupiterAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pythOracle",
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
          "name": "jupiterNonce",
          "type": "u8"
        },
        {
          "name": "positionIndex",
          "type": "u8"
        },
        {
          "name": "assetIndex",
          "type": "u8"
        },
        {
          "name": "cometCollateralIndex",
          "type": "u8"
        },
        {
          "name": "ilReductionAmount",
          "type": "u64"
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
            "name": "isManager",
            "type": "u64"
          },
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
          },
          {
            "name": "cometManager",
            "type": {
              "defined": "CometManager"
            }
          }
        ]
      }
    },
    {
      "name": "singlePoolComets",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "numComets",
            "type": "u64"
          },
          {
            "name": "comets",
            "type": {
              "array": [
                "publicKey",
                255
              ]
            }
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
      "name": "CometManager",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "membershipTokenMint",
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
    },
    {
      "name": "InceptError",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "InvalidMintCollateralRatio"
          },
          {
            "name": "InvalidCometCollateralRatio"
          },
          {
            "name": "DifferentScale"
          },
          {
            "name": "MathError"
          },
          {
            "name": "OracleConfidenceOutOfRange"
          },
          {
            "name": "AssetInfoNotFound"
          },
          {
            "name": "CollateralNotFound"
          },
          {
            "name": "PoolNotFound"
          },
          {
            "name": "InvalidCollateralType"
          },
          {
            "name": "InvalidTokenAmount"
          },
          {
            "name": "InvalidBool"
          },
          {
            "name": "InsufficientCollateral"
          },
          {
            "name": "NoPriceDeviationDetected"
          },
          {
            "name": "OutdatedOracle"
          },
          {
            "name": "CometAlreadyLiquidated"
          },
          {
            "name": "CometNotYetLiquidated"
          },
          {
            "name": "CometUnableToLiquidate"
          },
          {
            "name": "NonStablesNotSupported"
          },
          {
            "name": "MintPositionUnableToLiquidate"
          },
          {
            "name": "NoSuchCollateralPosition"
          },
          {
            "name": "InvalidHealthScoreCoefficient"
          },
          {
            "name": "FailedImpermanentLossCalculation"
          },
          {
            "name": "HealthScoreTooLow"
          },
          {
            "name": "InsufficientUSDiCollateral"
          },
          {
            "name": "AttemptedToAddNewPoolToSingleComet"
          },
          {
            "name": "AttemptedToAddNewCollateralToSingleComet"
          },
          {
            "name": "InvalidInputMintAccount"
          },
          {
            "name": "InvalidInputCollateralAccount"
          },
          {
            "name": "InvalidAccountLoaderOwner"
          },
          {
            "name": "InvalidInputPositionIndex"
          },
          {
            "name": "InvalidTokenAccountBalance"
          },
          {
            "name": "InequalityComparisonViolated"
          },
          {
            "name": "NotSinglePoolComet"
          },
          {
            "name": "SinglePoolCometNotEmpty"
          },
          {
            "name": "LiquidityNotWithdrawn"
          },
          {
            "name": "NotSubjectToLiquidation"
          },
          {
            "name": "NotSubjectToILLiquidation"
          },
          {
            "name": "LiquidationAmountTooLarge"
          },
          {
            "name": "NoRemainingAccountsSupplied"
          },
          {
            "name": "InvalidRecenter"
          },
          {
            "name": "NonZeroCollateralizationRatioRequired"
          }
        ]
      }
    },
    {
      "name": "HealthScore",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Healthy",
            "fields": [
              {
                "name": "score",
                "type": {
                  "defined": "f64"
                }
              }
            ]
          },
          {
            "name": "SubjectToLiquidation",
            "fields": [
              {
                "name": "score",
                "type": {
                  "defined": "f64"
                }
              }
            ]
          }
        ]
      }
    }
  ]
};
