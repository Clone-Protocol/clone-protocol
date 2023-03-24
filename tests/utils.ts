import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Provider } from "@project-serum/anchor";
import {
  Account,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sleep } from "../sdk/src/utils";
import { Decimal, toNumber } from "../sdk/src/decimal";
import { DEVNET_TOKEN_SCALE, InceptClient, toDevnetScale } from "../sdk/src/incept";
import { JupiterAggMock } from "../sdk/src/idl/jupiter_agg_mock";

export const INCEPT_EXCHANGE_SEED = Buffer.from("Incept");
export const EXCHANGE_ADMIN = new Keypair();
export const DEFAULT_PUBLIC_KEY = new PublicKey(0);

export const getOrCreateAssociatedTokenAccount = async (
  provider: Provider,
  mint: PublicKey,
  owner?: PublicKey,
  ownerOffCurve?: boolean
): Promise<Account> => {
  const associatedToken = await getAssociatedTokenAddress(
    mint,
    owner !== undefined ? owner : provider.publicKey!,
    ownerOffCurve !== undefined ? ownerOffCurve : false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  let account: Account;
  try {
    account = await getAccount(
      provider.connection,
      associatedToken,
      "recent",
      TOKEN_PROGRAM_ID
    );
  } catch (error: unknown) {
    if (error instanceof TokenAccountNotFoundError) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          provider.publicKey!,
          associatedToken,
          owner ? owner : provider.publicKey!,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      await provider.sendAndConfirm!(transaction);
      await sleep(6000);
      account = await getAccount(
        provider.connection,
        associatedToken,
        "recent",
        TOKEN_PROGRAM_ID
      );
    } else {
      throw error;
    }
  }

  if (!account) {
    throw Error("Could not create account!");
  }
  return account;
};

export const convertToRawDecimal = (num: number) => {
  let temp = new Decimal(BigInt(toDevnetScale(num).toNumber()), BigInt(DEVNET_TOKEN_SCALE));
  return temp.toRawDecimal();
}


export const recenterProcedureInstructions = async (incept: InceptClient, positionIndex: number, isSinglePool: boolean, jupiter_agg_mock?: JupiterAggMock) => {

  let ixs = []
  const comet = await (isSinglePool ? incept.getSinglePoolComets() : incept.getComet())
  const cometPosition = comet.positions[positionIndex]
  const lpTokens = toNumber(cometPosition.liquidityTokenValue)
  // Need to withdraw all liquidity from comet.
  const withdrawIx = await (
    isSinglePool ? incept.withdrawLiquidityFromSinglePoolCometInstruction(toDevnetScale(lpTokens), positionIndex) 
    : incept.withdrawLiquidityFromCometInstruction()
  )


  // Either buy or sell iasset depending on additional reward.
  // Should figure out the best combination route to take.

  // Pay ILD,

  // Deploy capital to the same amount of liquidity tokens.

}