export type JupiterAggMock = {
  "version": "0.1.0",
  "name": "jupiter_agg_mock",
  "docs": [
    "Lib"
  ],
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
          "name": "jupiterAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcMint",
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
      "args": []
    },
    {
      "name": "createAsset",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "assetMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "jupiterAccount",
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
          "name": "pythOracle",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "mintAsset",
      "accounts": [
        {
          "name": "assetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetTokenAccount",
          "isMut": true,
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
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u8"
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
      "name": "mintUsdc",
      "accounts": [
        {
          "name": "usdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcTokenAccount",
          "isMut": true,
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
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
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
          "name": "jupiterAccount",
          "isMut": false,
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
          "name": "userAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdcTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pythOracle",
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
          "name": "nonce",
          "type": "u8"
        },
        {
          "name": "assetIndex",
          "type": "u8"
        },
        {
          "name": "isAmountInput",
          "type": "bool"
        },
        {
          "name": "isAmountAsset",
          "type": "bool"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "jupiter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "usdcMint",
            "type": "publicKey"
          },
          {
            "name": "assetMints",
            "type": {
              "array": [
                "publicKey",
                10
              ]
            }
          },
          {
            "name": "oracles",
            "type": {
              "array": [
                "publicKey",
                10
              ]
            }
          },
          {
            "name": "answer",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "nAssets",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "RawDecimal",
      "docs": [
        "States"
      ],
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
    }
  ]
};

export const IDL: JupiterAggMock = {
  "version": "0.1.0",
  "name": "jupiter_agg_mock",
  "docs": [
    "Lib"
  ],
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
          "name": "jupiterAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcMint",
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
      "args": []
    },
    {
      "name": "createAsset",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "assetMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "jupiterAccount",
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
          "name": "pythOracle",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "mintAsset",
      "accounts": [
        {
          "name": "assetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "assetTokenAccount",
          "isMut": true,
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
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u8"
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
      "name": "mintUsdc",
      "accounts": [
        {
          "name": "usdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcTokenAccount",
          "isMut": true,
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
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
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
          "name": "jupiterAccount",
          "isMut": false,
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
          "name": "userAssetTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userUsdcTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pythOracle",
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
          "name": "nonce",
          "type": "u8"
        },
        {
          "name": "assetIndex",
          "type": "u8"
        },
        {
          "name": "isAmountInput",
          "type": "bool"
        },
        {
          "name": "isAmountAsset",
          "type": "bool"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "jupiter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "usdcMint",
            "type": "publicKey"
          },
          {
            "name": "assetMints",
            "type": {
              "array": [
                "publicKey",
                10
              ]
            }
          },
          {
            "name": "oracles",
            "type": {
              "array": [
                "publicKey",
                10
              ]
            }
          },
          {
            "name": "answer",
            "type": {
              "defined": "RawDecimal"
            }
          },
          {
            "name": "nAssets",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "RawDecimal",
      "docs": [
        "States"
      ],
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
    }
  ]
};
