import * as anchor from "@coral-xyz/anchor";
import { BN, Provider } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import { CloneClient, toDevnetScale } from "../sdk/src/clone";
import { calculateExecutionThreshold } from "../sdk/src/utils"
import { toDecimal, toNumber } from "../sdk/src/decimal"
import { getOrCreateAssociatedTokenAccount } from "../tests/utils";
import { getILD, getSinglePoolILD } from "../sdk/src/healthscore";
import { Jupiter, createMintAssetInstruction } from "../sdk/generated/jupiter-agg-mock/index"

export const getTokenAccount = async (
  mint: PublicKey,
  owner: PublicKey,
  connection: Connection
): Promise<PublicKey | undefined> => {
  const associatedToken = await getAssociatedTokenAddress(mint, owner);

  let account;

  try {
    account = await getAccount(
      connection,
      associatedToken,
      "processed",
      TOKEN_PROGRAM_ID
    );
  } catch (error: unknown) {
    if (error instanceof TokenAccountNotFoundError) {
      return undefined;
    } else {
      throw error;
    }
  }
  return account.address;
};

// export const getUSDiAccount = async (
//   clone: Clone
// ): Promise<PublicKey | undefined> => {
//   const onusdTokenAccount = await getTokenAccount(
//     clone.manager!.onusdMint,
//     clone.provider.wallet.publicKey,
//     clone.connection
//   );
//   return onusdTokenAccount!;
// };



const main = async (provider: Provider, programId: PublicKey) => {
  const program = new CloneClient(programId, provider);
  await program.loadManager();

  let tokenData = await program.getTokenData()
  let pool = tokenData.pools[0];

  const userUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
    program.provider,
    program.clone!.onusdMint,
    program.provider.publicKey!,
  )
  const userIassetTokenAccount = await getOrCreateAssociatedTokenAccount(
    program.provider,
    pool.assetInfo.iassetMint,
    program.provider.publicKey!,
  )
  const treasuryIassetTokenAccount = await getOrCreateAssociatedTokenAccount(
    program.provider,
    pool.assetInfo.iassetMint,
    program.clone!.treasuryAddress,
  )

  const amount = 12000

  // BUY
  const executionEst = calculateExecutionThreshold(
    amount,
    true,
    pool,
    0.0001
  );

  await program.hackathonMintUsdi(
    userUsdiTokenAccount.address,
    toDevnetScale(executionEst.onusdThresholdAmount).toNumber()
  )

  // Make a trade
  await program.buyIasset(
    toDevnetScale(amount), 
    userUsdiTokenAccount.address, 
    userIassetTokenAccount.address, 
    0, 
    toDevnetScale(executionEst.onusdThresholdAmount),
    treasuryIassetTokenAccount.address
  );
  /// SELL 
  // const executionEst = calculateExecutionThreshold(
  //   amount, false, pool, 0.0001
  // )
  // const [jupiterAccountAddress, jupiterNonce] =
  // PublicKey.findProgramAddressSync(
  //   [Buffer.from("jupiter")],
  //   new PublicKey('4tChJFNsWLMyk81ezv8N8gKVb2q7H1akSQENn4NToSuS')
  // );
  // const jupiter = await Jupiter.fromAccountAddress(provider.connection, jupiterAccountAddress);
  // const assetTokenAccount = await getOrCreateAssociatedTokenAccount(
  //   provider, jupiter.assetMints[0]
  // )
  // const iassetTokenAccount = await getOrCreateAssociatedTokenAccount(
  //   provider, tokenData.pools[0].assetInfo.iassetMint
  // )
  // const onusdTokenAccount = await getOrCreateAssociatedTokenAccount(
  //   provider, program.clone!.onusdMint
  // )
  // const treasuryUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
  //   provider, program.clone!.onusdMint, program.clone!.treasuryAddress
  // )
  // let tx = new Transaction();
  // // Mint jupiter asset
  // tx.add(await program.updatePricesInstruction())
  // tx.add(
  //   createMintAssetInstruction(
  //     {
  //       assetMint: jupiter.assetMints[0],
  //       assetTokenAccount: assetTokenAccount.address,
  //       jupiterAccount: jupiterAccountAddress,
  //       tokenProgram: TOKEN_PROGRAM_ID
  //     },
  //     {
  //       nonce: jupiterNonce,
  //       assetIndex: 0,
  //       amount: toDevnetScale(amount)
  //     }
  //   )
  // )
  // // Mint iasset
  // tx.add(
  //   await program.program.methods.wrapAsset(
  //     toDevnetScale(amount), 0
  //   ).accounts({
  //     user: provider.publicKey!,
  //     clone: program.cloneAddress[0],
  //     tokenData: program.clone!.tokenData,
  //     underlyingAssetTokenAccount: tokenData.pools[0].underlyingAssetTokenAccount,
  //     assetMint: jupiter.assetMints[0],
  //     iassetMint: tokenData.pools[0].assetInfo.iassetMint,
  //     userAssetTokenAccount: assetTokenAccount.address,
  //     userIassetTokenAccount: iassetTokenAccount.address,
  //     tokenProgram: TOKEN_PROGRAM_ID
  //   }).instruction()
  // )
  // // sell
  // tx.add(
  //   await program.sellIassetInstruction(
  //     onusdTokenAccount.address,
  //     iassetTokenAccount.address,
  //     toDevnetScale(amount),
  //     0,
  //     toDevnetScale(executionEst.onusdThresholdAmount),
  //     treasuryUsdiTokenAccount.address
  //   )
  // )
  // await provider.sendAndConfirm!(tx)

  tokenData = await program.getTokenData();
  for (let i = 0; i < tokenData.numPools.toNumber(); i++) {
    let pool = tokenData.pools[i];
    let oraclePrice = toNumber(pool.assetInfo.price);
    let onusdValue = toNumber(pool.onusdAmount);
    let iassetValue = toNumber(pool.iassetAmount)
    let poolPrice = onusdValue/iassetValue
    let lptokens = toNumber(pool.liquidityTokenSupply);
    console.log("pool:", i, oraclePrice, poolPrice, onusdValue, iassetValue, lptokens)
    //await getOrCreateAssociatedTokenAccount(program.provider, pool.assetInfo.iassetMint);
  }
  // const lookupTableAccount = await program.provider.connection
  // .getAddressLookupTable(new PublicKey("9kg7Za4f8C4aFZWqxrRqbZ3q2KKqdwA3PvRyy9fBpTpW"))
  // .then((res) => res.value);
  // lookupTableAccount?.state.addresses.forEach(x => console.log(x.toString()))


  //const onusdCollateralTokenAccount = await getUSDiAccount(program);

  // await program.openNewSinglePoolComet(
  //     onusdCollateralTokenAccount!,
  //     new BN(1000 * 10**8),
  //     new BN(100 * 10**8),
  //     0,
  //     0
  // )

  // Withdraw liquidity on comet.
  // const withdrawLiquidityFromCometIx =
  //   await program.withdrawLiquidityFromCometInstruction(
  //     new BN(10553.33001328 * 10 ** 8),
  //     1,
  //     false
  //   );
  // await program.provider.send(
  //   new anchor.web3.Transaction()
  //     .add(await program.updatePricesInstruction())
  //     .add(withdrawLiquidityFromCometIx),
  //   []
  // );
};

let provider;
let cloneProgramID;
if (process.env.DEVNET === "1") {
  console.log("RUNNING DEVNET");
  cloneProgramID = new PublicKey(
    "5k28XzdwaWVXaWBwfm4ZFXQAnBaTfzu25k1sHatsnsL1"
  );
  provider = anchor.AnchorProvider.env();//anchor.Provider.env();
} else {
  console.log("RUNNING LOCALNET");
  cloneProgramID = new PublicKey(
    "5k28XzdwaWVXaWBwfm4ZFXQAnBaTfzu25k1sHatsnsL1"
  );
  provider = anchor.AnchorProvider.local();
}

main(provider, cloneProgramID);
