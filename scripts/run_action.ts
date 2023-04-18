import * as anchor from "@coral-xyz/anchor";
import { BN, Provider } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import { InceptClient } from "../sdk/src/incept";
import { toNumber } from "../sdk/src/decimal"
import { getOrCreateAssociatedTokenAccount } from "../tests/utils";

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
//   incept: Incept
// ): Promise<PublicKey | undefined> => {
//   const usdiTokenAccount = await getTokenAccount(
//     incept.manager!.usdiMint,
//     incept.provider.wallet.publicKey,
//     incept.connection
//   );
//   return usdiTokenAccount!;
// };



const main = async (provider: Provider, programId: PublicKey) => {
  const program = new InceptClient(programId, provider);
  await program.loadManager();

  // console.log(program.provider.wallet.publicKey.toString());

  // const comet = await program.getComet();

  // console.log("Current address:", program.provider.wallet.publicKey.toString())
  // console.log("Admin address:", program.manager!.admin.toString())
  // let ix = await program.program.instruction.removePool(
  //   program.managerAddress[1],
  //   5,
  //   false, {
  //     accounts: {
  //       admin: program.provider.wallet.publicKey,
  //       manager: program.managerAddress[0],
  //       tokenData: program.manager!.tokenData,
  //     }
  //   }
  // );
  // await program.provider.send!(new Transaction().add(ix))

  const tokenData = await program.getTokenData();
  console.log("POOLS:", )
  for (let i = 0; i < tokenData.numPools.toNumber(); i++) {
    let pool = tokenData.pools[i];
    let oraclePrice = toNumber(pool.assetInfo.price);
    let usdiValue = toNumber(pool.usdiAmount);
    let iassetValue = toNumber(pool.iassetAmount)
    let poolPrice = usdiValue/iassetValue
    let lptokens = toNumber(pool.liquidityTokenSupply);
    console.log("pool:", i, oraclePrice, poolPrice, usdiValue, iassetValue, lptokens)
    //await getOrCreateAssociatedTokenAccount(program.provider, pool.assetInfo.iassetMint);

  }
  // const lookupTableAccount = await program.provider.connection
  // .getAddressLookupTable(new PublicKey("9kg7Za4f8C4aFZWqxrRqbZ3q2KKqdwA3PvRyy9fBpTpW"))
  // .then((res) => res.value);
  // lookupTableAccount?.state.addresses.forEach(x => console.log(x.toString()))


  //const usdiCollateralTokenAccount = await getUSDiAccount(program);

  // await program.openNewSinglePoolComet(
  //     usdiCollateralTokenAccount!,
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
let inceptProgramID;
if (process.env.DEVNET === "1") {
  console.log("RUNNING DEVNET");
  inceptProgramID = new PublicKey(
    "5k28XzdwaWVXaWBwfm4ZFXQAnBaTfzu25k1sHatsnsL1"
  );
  provider = anchor.AnchorProvider.env();//anchor.Provider.env();
} else {
  console.log("RUNNING LOCALNET");
  inceptProgramID = new PublicKey(
    "GHwfUCuT3mtCrqVdsvAQ3VZy8dn6WiouijPfpQpQT61e"
  );
  provider = anchor.AnchorProvider.local();
}

main(provider, inceptProgramID);
