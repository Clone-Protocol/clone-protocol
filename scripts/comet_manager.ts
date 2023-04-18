// Implements the comet manager strategy

import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import {
  PublicKey,
  Connection,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  DEVNET_TOKEN_SCALE,
  InceptClient,
  toDevnetScale,
} from "../sdk/src/incept";
import { getOrCreateAssociatedTokenAccount } from "../tests/utils";
import { toNumber } from "../sdk/src/decimal";
import {
  calculateExecutionThreshold,
  calculateExecutionThresholdFromParams,
  calculateInputFromOutputFromParams,
} from "../sdk/src/utils";
import { InceptCometManager, IDL } from "../sdk/src/idl/incept_comet_manager"
import { PythConnection, getPythProgramKeyForCluster, PriceData } from "@pythnetwork/client";
import { ManagerInfo, WithdrawCollateralFromCometInstructionAccounts, createWithdrawCollateralFromCometInstruction,
  AddCollateralToCometInstructionAccounts, InceptSwapInstructionAccounts, 
  JupiterMockSwapInstructionAccounts,
  createInceptSwapInstruction,
  WithdrawCollateralFromCometInstructionArgs,
  InceptSwapInstructionArgs, WithdrawLiquidityInstructionAccounts, createWithdrawLiquidityInstruction, WithdrawLiquidityInstructionArgs, createUnwrapIassetInstruction, UnwrapIassetInstructionAccounts, UnwrapIassetInstructionArgs, createJupiterMockSwapInstruction, JupiterMockSwapInstructionArgs, createMintUsdiInstruction, MintUsdiInstructionAccounts, MintUsdiInstructionArgs  } from "../sdk/generated/incept-comet-manager"
import { Jupiter } from '../sdk/generated/jupiter-agg-mock/index';
import { TokenData, Comet, createUpdatePricesInstruction, UpdatePricesInstructionAccounts, UpdatePricesInstructionArgs, User } from "../sdk/generated/incept/index"

type PoolState = {
  blockTime: number;
  signature: string;
  slot: number;
  eventId: number;
  poolIndex: number;
  iasset: number;
  usdi: number;
  lpTokens: number;
  oraclePrice: number;
};

// type ManagerInfo = {
//   inceptProgram: PublicKey
//   incept: PublicKey
//   owner: PublicKey
//   membershipTokenSupply: anchor.BN
//   userAccount: PublicKey
//   userBump: number
//   bump: number
//   status: object
//   withdrawalFeeBps: number
//   managementFeeBps: number
//   feeClaimTimestamp: number
//   redemptionStrikes: number
//   lastStrikeTimestamp: anchor.BN
//   netValueUsdi: anchor.BN
//   lastUpdateSlot: anchor.BN
//   userRedemptions: PublicKey[]
// }

type PythSymbol = string;
type PoolId = number;
type PythPriceData = Map<PoolId, PriceData>;
type PoolStateData = Map<PoolId, PoolState>;
interface TokenAccountAddresses {
  iassetToken: PublicKey[],
  underlyingToken?: PublicKey[],
  usdiToken: PublicKey,
  usdcToken: PublicKey
}

const getManagerTokenAccountAddresses = async (
  provider: anchor.AnchorProvider,
  managerAddress: PublicKey,
  tokenData: TokenData,
  usdiMint: PublicKey,
  usdcMint: PublicKey): Promise<TokenAccountAddresses> => {

  const nPools =  Number(tokenData.numPools!);

  const iassetMints = tokenData.pools.slice(0, nPools).map((pool) => {
    return pool.assetInfo.iassetMint
  })

  const iassetToken = (await Promise.all(
    iassetMints.map((mint) => {
      return getOrCreateAssociatedTokenAccount(
        provider,
        mint,
        managerAddress,
        true
      )
    })
  )).map(a => a.address);

  const underlyingToken = await Promise.all(
    tokenData.pools.slice(0, nPools).map(async (pool) => {
      const underlyingPoolAccount = await getAccount(provider.connection, pool.underlyingAssetTokenAccount, 'finalized')
      return (await getOrCreateAssociatedTokenAccount(provider, underlyingPoolAccount.mint, managerAddress, true)).address
    })
  )

  const usdiToken = (await getOrCreateAssociatedTokenAccount(
    provider, usdiMint, managerAddress, true)).address
  const usdcToken = (await getOrCreateAssociatedTokenAccount(
    provider, usdcMint, managerAddress, true)).address

  return {
    iassetToken,
    underlyingToken,
    usdiToken,
    usdcToken
  }
}

const getTreasuryTokenAccountAddresses = async (
  provider: anchor.AnchorProvider,
  treasuryAddress: PublicKey,
  tokenData: TokenData,
  usdiMint: PublicKey,
  usdcMint: PublicKey): Promise<TokenAccountAddresses> => {

  const nPools =  Number(tokenData.numPools!);

  const iassetMints = tokenData.pools.slice(0, nPools).map((pool) => {
    return pool.assetInfo.iassetMint
  })

  const iassetToken = (await Promise.all(
    iassetMints.map((mint) => {
      return getOrCreateAssociatedTokenAccount(
        provider,
        mint,
        treasuryAddress,
        false
      )
    })
  )).map(a => a.address);

  const usdiToken = (await getOrCreateAssociatedTokenAccount(
    provider, usdiMint, treasuryAddress, false)).address
  const usdcToken = (await getOrCreateAssociatedTokenAccount(
    provider, usdcMint, treasuryAddress, false)).address

  return {
    iassetToken,
    usdiToken,
    usdcToken,
  }
}
// Need to define mapping from pythSymbol to poolIndex
const PYTH_SYMBOL_MAPPING: Map<PythSymbol, PoolId> = new Map([
  ["FX.EUR/USD", 0],
  ["Metal.XAU/USD", 1],
  ["Crypto.SOL/USD", 2],
  ["Crypto.ETH/USD", 3],
  ["Crypto.BTC/USD", 4],
  ["Crypto.BNB/USD", 5],
  ["Crypto.AVAX/USD", 6],
  ["Equity.US.TSLA/USD", 7],
  ["Equity.US.AAPL/USD", 8],
  ["Equity.US.AMZN/USD", 9]
]);

const onPriceChangeUpdate = async (
  poolId: number,
  data: PriceData,
  poolData: PoolState,
  managerInfo: ManagerInfo,
  managerInfoAddress: PublicKey,
  managerAddresses: TokenAccountAddresses,
  treasuryAddresses: TokenAccountAddresses,
  managerInceptUser: User,
  inceptClient: InceptClient,
  tokenData: TokenData,
  comet: Comet,
  jupiter: Jupiter,
  jupiterProgramId: PublicKey,
  jupiterAddress: PublicKey,
  jupiterNonce: number,
  pythOracleAddress: PublicKey,
  pricePctThreshold: number,
  ): Promise<void> => {

    const poolPrice = poolData.usdi / poolData.iasset;
    const lowerThreshold = poolPrice / (1 + pricePctThreshold)
    const higherThrehsold = poolPrice * (1 + pricePctThreshold)
    const oraclePrice = data.price!;
    const lowerBreached = oraclePrice < lowerThreshold
    const higherBreached = oraclePrice > higherThrehsold
    if (!lowerBreached && !higherBreached)
      return;

    const cometPosition = (() => {
      for (let i=0; i < Number(comet.numPositions); i++) {
        if (comet.positions[i].poolIndex === poolId)
          return comet.positions[i]
      }
      return undefined
    })()

    if (cometPosition === undefined) {
      return;
    }

    const pool = tokenData.pools[poolId]
    const L = toNumber(cometPosition.liquidityTokenValue) / toNumber(pool.liquidityTokenSupply)
    const claimableUsdi = L * toNumber(pool.usdiAmount)
    const claimableIasset = L * toNumber(pool.iassetAmount)
    // Estimate pool after withdrawing all liquidity
    const newPoolUsdi = toNumber(pool.usdiAmount) - claimableUsdi
    const newPoolIasset = toNumber(pool.iassetAmount) - claimableIasset
    const newInvariant = newPoolIasset * newPoolUsdi
    // Figure out how much reward is gained, where to sell if in iasset.
    // Figure out how much ILD is owed.
    const iassetILD = toNumber(cometPosition.borrowedIasset) - claimableIasset
    const usdiILD = toNumber(cometPosition.borrowedUsdi) - claimableUsdi

    // Figure out how much buy/sell is needed to push price to oracle. NOTE that this will be arbed.
    // Use simple invariant equation for now. Positive means buy.
    const iassetInceptTrade = newPoolIasset - Math.sqrt(newInvariant / oraclePrice)
    // For other side of arb trade, always perform the opposite action but net the iasset ILD/reward.
    const jupiterExchangeTrade = -iassetInceptTrade + iassetILD
    // How much to convert, positive means convert to underlying -> iasset
    const convertToIasset = jupiterExchangeTrade

    // Setup instructions:
    const withdrawCollateralFromComet: WithdrawCollateralFromCometInstructionAccounts = {
      signer: managerInfo.owner,
      managerInfo: managerInfoAddress,
      incept: inceptClient.inceptAddress[0],
      managerInceptUser: managerInfo.incept,
      usdiMint: inceptClient.incept!.usdiMint,
      managerUsdiTokenAccount: managerAddresses.usdiToken,
      inceptProgram: managerInfo.inceptProgram,
      comet: managerInceptUser.comet,
      tokenData: inceptClient.incept!.tokenData,
      inceptUsdiVault: tokenData.collaterals[0].vault,
      tokenProgram: TOKEN_PROGRAM_ID,

    }
    const addCollateralAccounts: AddCollateralToCometInstructionAccounts = {
      managerOwner: managerInfo.owner,
      managerInfo: managerInfoAddress,
      incept: inceptClient.inceptAddress[0],
      managerInceptUser: managerInfo.incept,
      usdiMint: inceptClient.incept!.usdiMint,
      comet: managerInceptUser.comet,
      tokenData: inceptClient.incept!.tokenData,
      inceptUsdiVault: tokenData.collaterals[0].vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      inceptProgram: managerInfo.inceptProgram,
      managerUsdiTokenAccount: managerAddresses.usdiToken,
    };
    const inceptSwapAccounts: InceptSwapInstructionAccounts = {
      signer: managerInfo.owner,
      managerInfo: managerInfoAddress,
      incept: inceptClient.inceptAddress[0],
      usdiMint: inceptClient.incept!.usdiMint,
      managerUsdiTokenAccount: managerAddresses.usdiToken,
      treasuryUsdiTokenAccount: treasuryAddresses.usdiToken,
      treasuryIassetTokenAccount: treasuryAddresses.iassetToken[poolId],
      inceptProgram: managerInfo.inceptProgram,
      tokenData: inceptClient.incept!.tokenData,
      tokenProgram: TOKEN_PROGRAM_ID,
      ammUsdiTokenAccount: pool.usdiTokenAccount,
      ammIassetTokenAccount: pool.iassetTokenAccount,
      iassetMint: pool.assetInfo.iassetMint,
      managerIassetTokenAccount: managerAddresses.iassetToken[poolId],
    }
    const jupiterSwapAccounts: JupiterMockSwapInstructionAccounts = {
      signer: managerInfo.owner,
      managerInfo: managerInfoAddress,
      assetMint: jupiter.assetMints[poolId],
      tokenProgram: TOKEN_PROGRAM_ID,
      usdcMint: jupiter.usdcMint,
      managerAssetTokenAccount: managerAddresses.underlyingToken![poolId],
      managerUsdcTokenAccount: managerAddresses.usdcToken,
      jupiterProgram: jupiterProgramId,
      jupiterAccount: jupiterAddress,
      pythOracle: pythOracleAddress,
    }


    let instructions: TransactionInstruction[] = [
      // Update prices instruction.
      createUpdatePricesInstruction(
        {} as UpdatePricesInstructionAccounts,
        {} as UpdatePricesInstructionArgs
      ),
      // Withdraw all liquidity
      createWithdrawLiquidityInstruction(
        {} as WithdrawLiquidityInstructionAccounts,
        {} as WithdrawLiquidityInstructionArgs
      )
    ];

    // Figure out how much to withdraw
    const treasuryFee = toNumber(pool.treasuryTradingFee)
    const liquidityFee = toNumber(pool.liquidityTradingFee)
    // Buy first
    if (iassetInceptTrade > 0) {
      // Estimate required USDi
      const {input, resultPoolUsdi, resultPoolIasset} = calculateInputFromOutputFromParams(
        newPoolUsdi,
        newPoolIasset,
        treasuryFee,
        liquidityFee,
        iassetInceptTrade,
        false
      )
      const execution = calculateExecutionThresholdFromParams(
        iassetInceptTrade,
        true,
        newPoolUsdi,
        newPoolIasset,
        treasuryFee,
        liquidityFee,
        0.0050
      )
      // Withdraw USDi from collateral
      instructions.push(
        createWithdrawCollateralFromCometInstruction(
          withdrawCollateralFromComet,
          { amount: toDevnetScale(input) } as WithdrawCollateralFromCometInstructionArgs
        )
      )
      // Buy Iasset on incept
      instructions.push(
        createInceptSwapInstruction(
          inceptSwapAccounts,
          { isBuy: true, poolIndex: poolId,
            amount: toDevnetScale(iassetInceptTrade),
            usdiThreshold: execution.usdiThresholdAmount
          } as InceptSwapInstructionArgs
        )
      )
      // convert to asset
      instructions.push(
        createUnwrapIassetInstruction(
          {
            signer: managerInfo.owner,
            managerInfo: managerInfoAddress,
            incept: inceptClient.inceptAddress[0],
            iassetMint: tokenData.pools[poolId].assetInfo.iassetMint,
            managerIassetTokenAccount: managerAddresses.iassetToken[poolId],
            underlyingAssetTokenAccount: tokenData.pools[poolId].underlyingAssetTokenAccount,
            assetMint: jupiter.assetMints[poolId],
            managerAssetTokenAccount: managerAddresses.underlyingToken![poolId],
            inceptProgram: managerInfo.inceptProgram,
            tokenData: inceptClient.incept!.tokenData,
            tokenProgram: TOKEN_PROGRAM_ID,
          } as UnwrapIassetInstructionAccounts,
          { amount: toDevnetScale(Math.abs(jupiterExchangeTrade)), poolIndex: poolId} as UnwrapIassetInstructionArgs
        )
      )
      // sell underlying asset on jupiter
      instructions.push(
        createJupiterMockSwapInstruction(
          jupiterSwapAccounts,
          {
            jupiterNonce, isBuy: false, assetIndex: poolId, amount: toDevnetScale(Math.abs(jupiterExchangeTrade))
          } as JupiterMockSwapInstructionArgs
        )
      )
      // Convert USDC -> USDi
      instructions.push(
        createMintUsdiInstruction(
          {
            signer: managerInfo.owner,
            managerInfo: managerInfoAddress,
            incept: inceptClient.inceptAddress[0],
            usdiMint: inceptClient.incept!.usdiMint,
            managerUsdiTokenAccount: managerAddresses.usdiToken,
            usdcMint: jupiter.usdcMint,
            managerUsdcTokenAccount: managerAddresses.usdcToken,
            inceptProgram: managerInfo.inceptProgram,
            tokenData: inceptClient.incept!.tokenData,
            tokenProgram: TOKEN_PROGRAM_ID,
            inceptUsdcVault: tokenData.collaterals[0].vault
          } as MintUsdiInstructionAccounts,
          { amount: toDevnetScale() } as MintUsdiInstructionArgs
        )
      )
      // Deposit to collateral
    } else {
      // Estimate required USDC
      const requiredUsdc = jupiterExchangeTrade * toNumber(pool.assetInfo.price)
      // Withdraw USDi from collateral

      // Convert USDi -> USDC

      // buy underlying asset on jupiter

      // Convert from underlying to iasset.

      // sell on incept

      // Deposit USDi to collateral

    }
    // Pay ILD
    instructions.push(

    )

}


const main = async () => {
  let config = {
    inceptProgramID: new PublicKey(process.env.INCEPT_PROGRAM_ID!),
    inceptCometManager: new PublicKey(process.env.COMET_MANAGER_PROGRAM_ID!),
    cometManagerAccount: new PublicKey(process.env.COMET_MANAGER_ACCOUNT!),
    usdcMint: new PublicKey(process.env.USDC_MINT!),
    pctThreshold: 0.01,
  };
  const provider = anchor.AnchorProvider.env()


  const [userAccountAddress, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), provider.publicKey!.toBuffer()],
    config.inceptProgramID
  );

  const userAccount = await User.fromAccountAddress(provider.connection, userAccountAddress)

  const inceptClient = new InceptClient(
    config.inceptProgramID,
    provider
  );
  await inceptClient.loadManager();

  const managerProgram = new anchor.Program<InceptCometManager>(
    IDL, config.inceptCometManager, provider
  )

  // Market state objects
  let pythPrices: PythPriceData = new Map();
  let poolStates: PoolStateData = new Map();
  // Current manager state
  let managerState = await ManagerInfo.fromAccountAddress(
    provider.connection, config.cometManagerAccount,
  )

  let tokenData = await TokenData.fromAccountAddress(provider.connection, inceptClient.incept!.tokenData);
  let comet = await Comet.fromAccountAddress(provider.connection, userAccount.comet);

  const managerAddresses = await getManagerTokenAccountAddresses(
    provider,
    config.cometManagerAccount,
    tokenData,
    inceptClient.incept!.usdiMint,
    config.usdcMint
  )

  const treasuryAddresses = await getTreasuryTokenAccountAddresses(
    provider,
    inceptClient.incept!.treasuryAddress,
    tokenData,
    inceptClient.incept!.usdiMint,
    config.usdcMint
  )

  // Setup account listening
  // Subscribe to account changes
  managerProgram.account.managerInfo.subscribe(
    new PublicKey(config.cometManagerAccount), 'recent'
  ).on('change', (account: ManagerInfo) => {
    managerState = account;
  })
  inceptClient.program.account.tokenData.subscribe(
    inceptClient.incept!.tokenData, 'recent'
  ).on('change', (account: TokenData) => {
    tokenData = account;
  })
  inceptClient.program.account.comet.subscribe(
    userAccount.comet, 'recent'
  ).on('change', (account: Comet) => {
    comet = account;
  })

  // Setup pool listening
  inceptClient.program.addEventListener("PoolState", (event: PoolState, _slot: number) => {
    poolStates[event.poolIndex] = event
    onPriceChangeUpdate(
      event.poolIndex, pythPrices[event.poolIndex], event, managerState, managerProgram, tokenData, comet, config.pctThreshold
    ).then()
  })

  // Setup Pyth listening, NOTE: this is relavent for devnet only.
  // Once we switch away from using Jupiter Mock Agg into the real jupiter we'll have to 
  // figure out either streaming or polling quotes from Jupiter for our specific routes.
  const pythConnection = new PythConnection(provider.connection, getPythProgramKeyForCluster('devnet'))
  pythConnection.onPriceChange((product, data) => {
    let poolIndex = PYTH_SYMBOL_MAPPING.get(product.symbol)
    if (poolIndex === undefined)
      return;
    pythPrices[poolIndex] = data
    onPriceChangeUpdate(
      poolIndex, data, poolStates[poolIndex], managerState, managerProgram, tokenData, comet, config.pctThreshold
    ).then()
  })
  // Start listening for price change events.
  await pythConnection.start()
};

main();
