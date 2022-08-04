export type JupiterAggMock = {
  "version": "0.1.0",
  "name": "jupiter_agg_mock",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
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
      "args": [
        {
          "name": "nonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "createIasset",
      "accounts": [
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "iassetMint",
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
      "name": "mintIasset",
      "accounts": [
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetTokenAccount",
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
          "name": "iassetIndex",
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
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
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
          "name": "iassetIndex",
          "type": "u8"
        },
        {
          "name": "buy",
          "type": "bool"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "stressTest",
      "accounts": [
        {
          "name": "jupiterAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u8"
        },
        {
          "name": "iterations",
          "type": "u8"
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
            "name": "iassetMints",
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
            "name": "nIassets",
            "type": "u8"
          },
          {
            "name": "answer",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    }
  ],
  "types": [
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
    }
  ]
};

export const IDL: JupiterAggMock = {
  "version": "0.1.0",
  "name": "jupiter_agg_mock",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
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
      "args": [
        {
          "name": "nonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "createIasset",
      "accounts": [
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "iassetMint",
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
      "name": "mintIasset",
      "accounts": [
        {
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "iassetTokenAccount",
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
          "name": "iassetIndex",
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
          "name": "iassetMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userIassetTokenAccount",
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
          "name": "iassetIndex",
          "type": "u8"
        },
        {
          "name": "buy",
          "type": "bool"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "stressTest",
      "accounts": [
        {
          "name": "jupiterAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u8"
        },
        {
          "name": "iterations",
          "type": "u8"
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
            "name": "iassetMints",
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
            "name": "nIassets",
            "type": "u8"
          },
          {
            "name": "answer",
            "type": {
              "defined": "RawDecimal"
            }
          }
        ]
      }
    }
  ],
  "types": [
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
    }
  ]
};
