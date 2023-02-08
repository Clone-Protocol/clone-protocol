export type InceptCometManager = {
  "version": "0.1.0",
  "name": "incept_comet_manager",
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
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
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
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
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
          "name": "userBump",
          "type": "u8"
        },
        {
          "name": "healthScoreThreshold",
          "type": "u8"
        },
        {
          "name": "withdrawalFeeBps",
          "type": "u16"
        },
        {
          "name": "managementFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "managementFeeClaim",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ownerAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "initializeSubscription",
      "accounts": [
        {
          "name": "subscriptionOwner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "subscriber",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInfo",
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
      "args": []
    },
    {
      "name": "subscribe",
      "accounts": [
        {
          "name": "subscriber",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "subscriberAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "subscriberUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
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
          "name": "usdiCollateralToProvide",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeem",
      "accounts": [
        {
          "name": "subscriber",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "subscriberAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "subscriberUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
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
          "name": "membershipTokensToRedeem",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addLiquidity",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
      "name": "withdrawLiquidity",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
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
      "name": "recenter",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
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
      "name": "payIld",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
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
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "ownerWithdrawal",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ownerUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdiTokenAccount",
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
          "name": "usdiAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initiateCometManagerTermination",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "terminateCometManager",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ownerUsdiTokenAccount",
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
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "managerInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "inceptProgram",
            "type": "publicKey"
          },
          {
            "name": "incept",
            "type": "publicKey"
          },
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "membershipTokenSupply",
            "type": "u64"
          },
          {
            "name": "userAccount",
            "type": "publicKey"
          },
          {
            "name": "userBump",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "healthScoreThreshold",
            "type": "u8"
          },
          {
            "name": "inClosingSequence",
            "type": "bool"
          },
          {
            "name": "terminationSlot",
            "type": "u64"
          },
          {
            "name": "withdrawalFeeBps",
            "type": "u16"
          },
          {
            "name": "managementFeeBps",
            "type": "u16"
          },
          {
            "name": "feeClaimSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "subscriber",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "manager",
            "type": "publicKey"
          },
          {
            "name": "principal",
            "type": "u64"
          },
          {
            "name": "membershipTokens",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidActionWhenInTerminationSequence",
      "msg": "Can't perform this action when in termination sequence"
    },
    {
      "code": 6001,
      "name": "MustBeInTerminationSequence",
      "msg": "Must perform this action when in termination sequence"
    },
    {
      "code": 6002,
      "name": "ThresholdTooLow",
      "msg": "Threshold must be greater than protocol threshold"
    },
    {
      "code": 6003,
      "name": "CometMustHaveNoPositions",
      "msg": "Comet must have no liquidity positions"
    },
    {
      "code": 6004,
      "name": "TooEarlyToClaimReward",
      "msg": "Too early to claim reward"
    },
    {
      "code": 6005,
      "name": "InvalidMembershipTokenBalance",
      "msg": "Invalid membership token balance"
    },
    {
      "code": 6006,
      "name": "TooEarlyToPerformTermination",
      "msg": "Too early to perform final termination"
    },
    {
      "code": 6007,
      "name": "HealthScoreBelowThreshold",
      "msg": "Health score below threshold"
    }
  ]
};

export const IDL: InceptCometManager = {
  "version": "0.1.0",
  "name": "incept_comet_manager",
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
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
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
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
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
          "name": "userBump",
          "type": "u8"
        },
        {
          "name": "healthScoreThreshold",
          "type": "u8"
        },
        {
          "name": "withdrawalFeeBps",
          "type": "u16"
        },
        {
          "name": "managementFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "managementFeeClaim",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ownerAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "initializeSubscription",
      "accounts": [
        {
          "name": "subscriptionOwner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "subscriber",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInfo",
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
      "args": []
    },
    {
      "name": "subscribe",
      "accounts": [
        {
          "name": "subscriber",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "subscriberAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "subscriberUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
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
          "name": "usdiCollateralToProvide",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeem",
      "accounts": [
        {
          "name": "subscriber",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "subscriberAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "subscriberUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
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
          "name": "membershipTokensToRedeem",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addLiquidity",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
      "name": "withdrawLiquidity",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
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
      "name": "recenter",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
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
      "name": "payIld",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
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
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "ownerWithdrawal",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ownerUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdiTokenAccount",
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
          "name": "usdiAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initiateCometManagerTermination",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "terminateCometManager",
      "accounts": [
        {
          "name": "managerOwner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incept",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdiMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdiVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ownerUsdiTokenAccount",
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
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "managerInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "inceptProgram",
            "type": "publicKey"
          },
          {
            "name": "incept",
            "type": "publicKey"
          },
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "membershipTokenSupply",
            "type": "u64"
          },
          {
            "name": "userAccount",
            "type": "publicKey"
          },
          {
            "name": "userBump",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "healthScoreThreshold",
            "type": "u8"
          },
          {
            "name": "inClosingSequence",
            "type": "bool"
          },
          {
            "name": "terminationSlot",
            "type": "u64"
          },
          {
            "name": "withdrawalFeeBps",
            "type": "u16"
          },
          {
            "name": "managementFeeBps",
            "type": "u16"
          },
          {
            "name": "feeClaimSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "subscriber",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "manager",
            "type": "publicKey"
          },
          {
            "name": "principal",
            "type": "u64"
          },
          {
            "name": "membershipTokens",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidActionWhenInTerminationSequence",
      "msg": "Can't perform this action when in termination sequence"
    },
    {
      "code": 6001,
      "name": "MustBeInTerminationSequence",
      "msg": "Must perform this action when in termination sequence"
    },
    {
      "code": 6002,
      "name": "ThresholdTooLow",
      "msg": "Threshold must be greater than protocol threshold"
    },
    {
      "code": 6003,
      "name": "CometMustHaveNoPositions",
      "msg": "Comet must have no liquidity positions"
    },
    {
      "code": 6004,
      "name": "TooEarlyToClaimReward",
      "msg": "Too early to claim reward"
    },
    {
      "code": 6005,
      "name": "InvalidMembershipTokenBalance",
      "msg": "Invalid membership token balance"
    },
    {
      "code": 6006,
      "name": "TooEarlyToPerformTermination",
      "msg": "Too early to perform final termination"
    },
    {
      "code": 6007,
      "name": "HealthScoreBelowThreshold",
      "msg": "Health score below threshold"
    }
  ]
};
