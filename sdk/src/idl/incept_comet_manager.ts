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
      "name": "redeemFromClosedManager",
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
        }
      ],
      "args": []
    },
    {
      "name": "requestRedemption",
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
      "name": "fulfillRedemptionRequest",
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
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "subscriberAccount",
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
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "assignRedemptionStrike",
      "accounts": [
        {
          "name": "signer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "subscriberAccount",
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
          "isMut": true,
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
      "name": "addCollateralToComet",
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
          "isMut": false,
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
      "name": "withdrawCollateralFromComet",
      "accounts": [
        {
          "name": "signer",
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
          "isMut": true,
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
      "name": "withdrawLiquidity",
      "accounts": [
        {
          "name": "signer",
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
          "isMut": true,
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
          "name": "managerIassetTokenAccount",
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
      "name": "payIld",
      "accounts": [
        {
          "name": "signer",
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
          "isMut": true,
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
          "name": "managerIassetTokenAccount",
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
        },
        {
          "name": "payUsdiDebt",
          "type": "bool"
        }
      ]
    },
    {
      "name": "removeCometPosition",
      "accounts": [
        {
          "name": "signer",
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
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
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
      "name": "initiateCometManagerClosing",
      "accounts": [
        {
          "name": "signer",
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
      "name": "closeCometManager",
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
          "name": "treasuryUsdiTokenAccount",
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
    },
    {
      "name": "burnUsdi",
      "accounts": [
        {
          "name": "signer",
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
          "name": "usdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdcTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdcVault",
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
      "name": "mintUsdi",
      "accounts": [
        {
          "name": "signer",
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
          "name": "usdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdcTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdcVault",
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
      "name": "wrapAsset",
      "accounts": [
        {
          "name": "signer",
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
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "underlyingAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
      "name": "unwrapIasset",
      "accounts": [
        {
          "name": "signer",
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
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "underlyingAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
      "name": "inceptSwap",
      "accounts": [
        {
          "name": "signer",
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
          "name": "treasuryUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
          "name": "isBuy",
          "type": "bool"
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
          "name": "usdiThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "jupiterMockSwap",
      "accounts": [
        {
          "name": "signer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
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
          "name": "managerAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdcTokenAccount",
          "isMut": true,
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
          "name": "tokenProgram",
          "isMut": false,
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
          "name": "jupiterNonce",
          "type": "u8"
        },
        {
          "name": "isBuy",
          "type": "bool"
        },
        {
          "name": "assetIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateNetValue",
      "accounts": [
        {
          "name": "signer",
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
          "isMut": true,
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
          "name": "managerUsdiTokenAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerUsdcTokenAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
            "name": "status",
            "type": {
              "defined": "CometManagerStatus"
            }
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
            "name": "feeClaimTimestamp",
            "type": "u64"
          },
          {
            "name": "redemptionStrikes",
            "type": "u8"
          },
          {
            "name": "lastStrikeTimestamp",
            "type": "u64"
          },
          {
            "name": "netValueUsdi",
            "type": "u64"
          },
          {
            "name": "lastUpdateSlot",
            "type": "u64"
          },
          {
            "name": "userRedemptions",
            "type": {
              "vec": "publicKey"
            }
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
          },
          {
            "name": "redemptionRequest",
            "type": {
              "option": {
                "defined": "RedemptionRequest"
              }
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "RedemptionRequest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "membershipTokens",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "CometManagerStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Open"
          },
          {
            "name": "Closing",
            "fields": [
              {
                "name": "forcefully_closed",
                "type": "bool"
              },
              {
                "name": "termination_timestamp",
                "type": "u64"
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
      "name": "CometMustHaveNoPositions",
      "msg": "Comet must have no liquidity positions"
    },
    {
      "code": 6001,
      "name": "ManagerAtStrikeLimit",
      "msg": "Manager at/beyond strike limit"
    },
    {
      "code": 6002,
      "name": "RequireManagerAtStrikeLimit",
      "msg": "Require manager to be at/beyond strike limit"
    },
    {
      "code": 6003,
      "name": "TooEarlyToClaimReward",
      "msg": "Too early to claim reward"
    },
    {
      "code": 6004,
      "name": "InvalidMembershipTokenBalance",
      "msg": "Invalid membership token balance"
    },
    {
      "code": 6005,
      "name": "TooEarlyToPerformTermination",
      "msg": "Too early to perform final termination"
    },
    {
      "code": 6006,
      "name": "OpenStatusRequired",
      "msg": "Required that the manager is in open status"
    },
    {
      "code": 6007,
      "name": "ClosingStatusRequired",
      "msg": "Required that the manager is in closing status"
    },
    {
      "code": 6008,
      "name": "RequestAlreadySent",
      "msg": "Request already sent"
    },
    {
      "code": 6009,
      "name": "OutstandingRedemptionsQueueFull",
      "msg": "Outstanding request queue is full, try again soon"
    },
    {
      "code": 6010,
      "name": "InvalidIndex",
      "msg": "Invalid index"
    },
    {
      "code": 6011,
      "name": "RequestNotValidForStrike",
      "msg": "Request not valid for strike"
    },
    {
      "code": 6012,
      "name": "InvalidForForcefullyClosedManagers",
      "msg": "Invalid for forcefully closed manager"
    },
    {
      "code": 6013,
      "name": "MustBeForcefullyClosedManagers",
      "msg": "Valid for forcefully closed manager"
    },
    {
      "code": 6014,
      "name": "DepositAmountTooLow",
      "msg": "Deposit amount too low"
    },
    {
      "code": 6015,
      "name": "WithdrawalAmountInvalid",
      "msg": "Invalid withdrawal amount!"
    },
    {
      "code": 6016,
      "name": "RedemptionsMustBeFulfilled",
      "msg": "All redemptions must be fulfilled!"
    },
    {
      "code": 6017,
      "name": "OutdatedUpdateSlot",
      "msg": "Outdated update slot"
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
      "name": "redeemFromClosedManager",
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
        }
      ],
      "args": []
    },
    {
      "name": "requestRedemption",
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
      "name": "fulfillRedemptionRequest",
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
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "subscriberAccount",
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
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "assignRedemptionStrike",
      "accounts": [
        {
          "name": "signer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "subscriberAccount",
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
          "isMut": true,
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
      "name": "addCollateralToComet",
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
          "isMut": false,
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
      "name": "withdrawCollateralFromComet",
      "accounts": [
        {
          "name": "signer",
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
          "isMut": true,
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
      "name": "withdrawLiquidity",
      "accounts": [
        {
          "name": "signer",
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
          "isMut": true,
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
          "name": "managerIassetTokenAccount",
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
      "name": "payIld",
      "accounts": [
        {
          "name": "signer",
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
          "isMut": true,
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
          "name": "managerIassetTokenAccount",
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
        },
        {
          "name": "payUsdiDebt",
          "type": "bool"
        }
      ]
    },
    {
      "name": "removeCometPosition",
      "accounts": [
        {
          "name": "signer",
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
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerInceptUser",
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
      "name": "initiateCometManagerClosing",
      "accounts": [
        {
          "name": "signer",
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
      "name": "closeCometManager",
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
          "name": "treasuryUsdiTokenAccount",
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
    },
    {
      "name": "burnUsdi",
      "accounts": [
        {
          "name": "signer",
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
          "name": "usdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdcTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdcVault",
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
      "name": "mintUsdi",
      "accounts": [
        {
          "name": "signer",
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
          "name": "usdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdcTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptUsdcVault",
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
      "name": "wrapAsset",
      "accounts": [
        {
          "name": "signer",
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
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "underlyingAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
      "name": "unwrapIasset",
      "accounts": [
        {
          "name": "signer",
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
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "underlyingAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
      "name": "inceptSwap",
      "accounts": [
        {
          "name": "signer",
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
          "name": "treasuryUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammUsdiTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammIassetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inceptProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
          "name": "isBuy",
          "type": "bool"
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
          "name": "usdiThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "jupiterMockSwap",
      "accounts": [
        {
          "name": "signer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "managerInfo",
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
          "name": "managerAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "managerUsdcTokenAccount",
          "isMut": true,
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
          "name": "tokenProgram",
          "isMut": false,
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
          "name": "jupiterNonce",
          "type": "u8"
        },
        {
          "name": "isBuy",
          "type": "bool"
        },
        {
          "name": "assetIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateNetValue",
      "accounts": [
        {
          "name": "signer",
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
          "isMut": true,
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
          "name": "managerUsdiTokenAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "managerUsdcTokenAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "comet",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenData",
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
            "name": "status",
            "type": {
              "defined": "CometManagerStatus"
            }
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
            "name": "feeClaimTimestamp",
            "type": "u64"
          },
          {
            "name": "redemptionStrikes",
            "type": "u8"
          },
          {
            "name": "lastStrikeTimestamp",
            "type": "u64"
          },
          {
            "name": "netValueUsdi",
            "type": "u64"
          },
          {
            "name": "lastUpdateSlot",
            "type": "u64"
          },
          {
            "name": "userRedemptions",
            "type": {
              "vec": "publicKey"
            }
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
          },
          {
            "name": "redemptionRequest",
            "type": {
              "option": {
                "defined": "RedemptionRequest"
              }
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "RedemptionRequest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "membershipTokens",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "CometManagerStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Open"
          },
          {
            "name": "Closing",
            "fields": [
              {
                "name": "forcefully_closed",
                "type": "bool"
              },
              {
                "name": "termination_timestamp",
                "type": "u64"
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
      "name": "CometMustHaveNoPositions",
      "msg": "Comet must have no liquidity positions"
    },
    {
      "code": 6001,
      "name": "ManagerAtStrikeLimit",
      "msg": "Manager at/beyond strike limit"
    },
    {
      "code": 6002,
      "name": "RequireManagerAtStrikeLimit",
      "msg": "Require manager to be at/beyond strike limit"
    },
    {
      "code": 6003,
      "name": "TooEarlyToClaimReward",
      "msg": "Too early to claim reward"
    },
    {
      "code": 6004,
      "name": "InvalidMembershipTokenBalance",
      "msg": "Invalid membership token balance"
    },
    {
      "code": 6005,
      "name": "TooEarlyToPerformTermination",
      "msg": "Too early to perform final termination"
    },
    {
      "code": 6006,
      "name": "OpenStatusRequired",
      "msg": "Required that the manager is in open status"
    },
    {
      "code": 6007,
      "name": "ClosingStatusRequired",
      "msg": "Required that the manager is in closing status"
    },
    {
      "code": 6008,
      "name": "RequestAlreadySent",
      "msg": "Request already sent"
    },
    {
      "code": 6009,
      "name": "OutstandingRedemptionsQueueFull",
      "msg": "Outstanding request queue is full, try again soon"
    },
    {
      "code": 6010,
      "name": "InvalidIndex",
      "msg": "Invalid index"
    },
    {
      "code": 6011,
      "name": "RequestNotValidForStrike",
      "msg": "Request not valid for strike"
    },
    {
      "code": 6012,
      "name": "InvalidForForcefullyClosedManagers",
      "msg": "Invalid for forcefully closed manager"
    },
    {
      "code": 6013,
      "name": "MustBeForcefullyClosedManagers",
      "msg": "Valid for forcefully closed manager"
    },
    {
      "code": 6014,
      "name": "DepositAmountTooLow",
      "msg": "Deposit amount too low"
    },
    {
      "code": 6015,
      "name": "WithdrawalAmountInvalid",
      "msg": "Invalid withdrawal amount!"
    },
    {
      "code": 6016,
      "name": "RedemptionsMustBeFulfilled",
      "msg": "All redemptions must be fulfilled!"
    },
    {
      "code": 6017,
      "name": "OutdatedUpdateSlot",
      "msg": "Outdated update slot"
    }
  ]
};
