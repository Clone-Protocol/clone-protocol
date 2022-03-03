export type MockUsdc = {
  "version": "0.1.0",
  "name": "mock_usdc",
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
          "name": "mockUsdcAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mockUsdcMint",
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
          "name": "mockUsdcNonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "mintMockUsdc",
      "accounts": [
        {
          "name": "mockUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mockUsdcTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mockUsdcAccount",
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
          "name": "mockUsdcNonce",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "mockUsdc",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mockUsdcMint",
            "type": "publicKey"
          }
        ]
      }
    }
  ]
};

export const IDL: MockUsdc = {
  "version": "0.1.0",
  "name": "mock_usdc",
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
          "name": "mockUsdcAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mockUsdcMint",
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
          "name": "mockUsdcNonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "mintMockUsdc",
      "accounts": [
        {
          "name": "mockUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mockUsdcTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mockUsdcAccount",
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
          "name": "mockUsdcNonce",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "mockUsdc",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mockUsdcMint",
            "type": "publicKey"
          }
        ]
      }
    }
  ]
};
