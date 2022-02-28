export type Pyth = {
  "version": "0.1.0",
  "name": "pyth",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "price",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "i64"
        },
        {
          "name": "expo",
          "type": "i32"
        },
        {
          "name": "conf",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setPrice",
      "accounts": [
        {
          "name": "price",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "i64"
        }
      ]
    }
  ],
  "types": [
    {
      "name": "PriceStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Unknown"
          },
          {
            "name": "Trading"
          },
          {
            "name": "Halted"
          },
          {
            "name": "Auction"
          }
        ]
      }
    },
    {
      "name": "CorpAction",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "NoCorpAct"
          }
        ]
      }
    },
    {
      "name": "PriceType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Unknown"
          },
          {
            "name": "Price"
          },
          {
            "name": "TWAP"
          },
          {
            "name": "Volatility"
          }
        ]
      }
    }
  ],
  "metadata": {
    "address": "4te7G6yemnSx2zByo1GRTWY4uNBrrcwjJc9uKxbPZ4Qe"
  }
}

export const IDL: Pyth = {
  "version": "0.1.0",
  "name": "pyth",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "price",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "i64"
        },
        {
          "name": "expo",
          "type": "i32"
        },
        {
          "name": "conf",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setPrice",
      "accounts": [
        {
          "name": "price",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "i64"
        }
      ]
    }
  ],
  "types": [
    {
      "name": "PriceStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Unknown"
          },
          {
            "name": "Trading"
          },
          {
            "name": "Halted"
          },
          {
            "name": "Auction"
          }
        ]
      }
    },
    {
      "name": "CorpAction",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "NoCorpAct"
          }
        ]
      }
    },
    {
      "name": "PriceType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Unknown"
          },
          {
            "name": "Price"
          },
          {
            "name": "TWAP"
          },
          {
            "name": "Volatility"
          }
        ]
      }
    }
  ],
  "metadata": {
    "address": "4te7G6yemnSx2zByo1GRTWY4uNBrrcwjJc9uKxbPZ4Qe"
  }
}