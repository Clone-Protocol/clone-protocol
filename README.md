# Incept Protocol
This repository contains the on-chain programs for the Incept Protocol:
- `incept` the main program which contains all logic for minting, borrowing, trading and liquidity provisioning
- `mock-usdc` a substitute program only used for testing, allows you to freely mint USDC to use as collateral.
- `pyth` a substitute program only used for testing, allows you to change oracle prices at will, used for scenario testing.
- `store` a local version from the Chainlink [repo](https://github.com/smartcontractkit/chainlink-solana/tree/develop/contracts/programs/store), used for local testing of the Chainlink oracle price feed.
- `access-controller` required as a dependency for `store`, also pulled from the Chainlink repo.

## How to Run
Incept is built using [Anchor](https://project-serum.github.io/anchor/getting-started/installation.html#install-rust) and requires its installation.

After installing you can test, build and deploy using `anchor test`, `anchor build` and `anchor deploy`.