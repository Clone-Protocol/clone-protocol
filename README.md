# Clone Protocol
This repository contains the on-chain programs for the Clone Protocol:
- `clone` the main program which contains all logic for minting, borrowing, trading and liquidity provisioning
- `pyth` a substitute program only used for testing, allows you to change oracle prices at will, used for scenario testing.
- `jupiter-mock-agg` a mock program of the Jupiter Aggregator, used for local and dev environments.

## How to Run
Clone is built using [Anchor](https://project-serum.github.io/anchor/getting-started/installation.html#install-rust) and requires its installation.

After installing you can test, build and deploy using `anchor test`, `anchor build` and `anchor deploy`.

## Generating Solita SDK
Run `PROGRAM_DIR=<program> yarn solita` to generate the SDK in the `sdk/generated/` folder. The `<program>` name corresponds to the directory name listed in `programs/`.
Implementation details of this auto-generation is in the `.solitarc.js` file.
