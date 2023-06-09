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
  CloneClient,
  toDevnetScale,
} from "../sdk/src/clone";
import { BorrowPositions, TokenData, User } from "../sdk/src/interfaces";
import { getOrCreateAssociatedTokenAccount } from "../tests/utils";
import { toNumber } from "../sdk/src/decimal";
import {
  calculateInputFromOutput,
  calculateOutputFromInput,
  sleep,
} from "../sdk/src/utils";

interface TokenAccounts {
  userUsdi: PublicKey;
  userIassets: PublicKey[];
  treasuryUsdi: PublicKey;
  treasuryIasset: PublicKey[];
}

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

const generatePeggingInstructions = async (
  clone: CloneClient,
  userBorrows: BorrowPositions,
  poolIndex: number,
  percentThreshold: number,
  accounts: TokenAccounts
): Promise<TransactionInstruction[]> => {
  const tokenData = await clone.getTokenData();
  let pool = tokenData.pools[poolIndex];

  let poolUsdi = toNumber(pool.onusdAmount);
  let poolIasset = toNumber(pool.iassetAmount);
  let poolPrice = poolUsdi / poolIasset;
  let oraclePrice = toNumber(pool.assetInfo.price);

  if (Math.abs(poolPrice - oraclePrice) / oraclePrice <= percentThreshold)
    return [];

  let ixCalls: Promise<TransactionInstruction>[] = [];
  ixCalls.push(clone.updatePricesInstruction());

  // Mint extra onusd if required.
  let onusdAccount = await getAccount(
    clone.provider.connection,
    accounts.userUsdi
  );
  let onusdBalance = Number(onusdAccount.amount) * 10 ** -DEVNET_TOKEN_SCALE;

  const adjustedIassetRatio = Math.sqrt((poolUsdi * poolIasset) / oraclePrice);

  if (oraclePrice > poolPrice) {
    // Need to buy iasset
    let iassetRequiredToBuy = poolIasset - adjustedIassetRatio;
    let onusdRequired = calculateInputFromOutput(
      pool,
      iassetRequiredToBuy,
      false
    ).input;
    if (onusdRequired > onusdBalance) {
      ixCalls.push(
        clone.hackathonMintUsdiInstruction(
          accounts.userUsdi,
          toDevnetScale(onusdRequired - onusdBalance).toNumber()
        )
      );
    }

    ixCalls.push(
      clone.buyIassetInstruction(
        accounts.userUsdi,
        accounts.userIassets[poolIndex],
        toDevnetScale(iassetRequiredToBuy),
        poolIndex,
        toDevnetScale(onusdRequired * 1.1),
        accounts.treasuryIasset[poolIndex]
      )
    );
  } else {
    let iassetRequiredToSell = adjustedIassetRatio - poolIasset;
    let onusdRequiredforMint = 2 * iassetRequiredToSell * oraclePrice;

    if (onusdRequiredforMint > onusdBalance) {
      ixCalls.push(
        clone.hackathonMintUsdiInstruction(
          accounts.userUsdi,
          toDevnetScale(onusdRequiredforMint * 1.1 - onusdBalance).toNumber()
        )
      );
    }

    let onusdGained = calculateOutputFromInput(
      pool,
      iassetRequiredToSell,
      false
    ).output;

    // Check if we have a borrow position already
    let borrowPositionIndex = -1;

    for (let [i, borrow] of userBorrows.borrowPositions
      .slice(0, userBorrows.numPositions.toNumber())
      .entries()) {
      if (borrow.poolIndex === poolIndex) {
        borrowPositionIndex = i;
        break;
      }
    }

    if (borrowPositionIndex === -1) {
      ixCalls.push(
        clone.initializeBorrowPositionInstruction(
          accounts.userUsdi,
          accounts.userIassets[poolIndex],
          toDevnetScale(iassetRequiredToSell),
          toDevnetScale(onusdRequiredforMint),
          poolIndex,
          0
        )
      );
    } else {
      ixCalls.push(
        clone.addCollateralToBorrowInstruction(
          borrowPositionIndex,
          accounts.userUsdi,
          toDevnetScale(onusdRequiredforMint)
        )
      );
      ixCalls.push(
        clone.subtractIassetFromBorrowInstruction(
          accounts.userIassets[poolIndex],
          toDevnetScale(iassetRequiredToSell),
          borrowPositionIndex
        )
      );
    }

    ixCalls.push(
      clone.sellIassetInstruction(
        accounts.userUsdi,
        accounts.userIassets[poolIndex],
        toDevnetScale(iassetRequiredToSell),
        poolIndex,
        toDevnetScale(onusdGained * 0.9),
        accounts.treasuryUsdi
      )
    );
  }

  let ixs = await Promise.all(ixCalls);
  return ixs;
};

const pegPrices = async (
  clone: CloneClient,
  accounts: TokenAccounts,
  pctThreshold: number
) => {
  await clone.updatePrices();
  const tokenData = await clone.getTokenData();
  const userAccount = await clone.getUserAccount();

  if (userAccount.borrowPositions.equals(anchor.web3.PublicKey.default)) {
    const { userPubkey, bump } = await clone.getUserAddress();
    const borrowPositionsKeypair = anchor.web3.Keypair.generate();
    console.log(
      "Generating borrow position account:",
      borrowPositionsKeypair.publicKey.toString()
    );
    await clone.program.methods
      .initializeBorrowPositions()
      .accounts({
        user: clone.provider.publicKey!,
        userAccount: userPubkey,
        borrowPositions: borrowPositionsKeypair.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .preInstructions([
        await clone.program.account.borrowPositions.createInstruction(
          borrowPositionsKeypair
        ),
      ])
      .signers([borrowPositionsKeypair])
      .rpc();
    await sleep(4000);
  }

  const userBorrows = await clone.getBorrowPositions();

  for (
    let poolIndex = 0;
    poolIndex < tokenData.numPools.toNumber();
    poolIndex++
  ) {
    let ixs = await generatePeggingInstructions(
      clone,
      userBorrows,
      poolIndex,
      pctThreshold,
      accounts
    );

    if (ixs.length === 0) continue;

    let tx = new Transaction();

    ixs.forEach((ix) => tx.add(ix));

    await clone.provider.sendAndConfirm!(tx, []);
    console.log("Price pegged for pool:", poolIndex);
  }
};

const fetchAccounts = async (clone: CloneClient): Promise<TokenAccounts> => {
  const tokenData = await clone.getTokenData();

  let [userUsdi, treasuryUsdi] = await Promise.all([
    getOrCreateAssociatedTokenAccount(
      clone.provider,
      clone.clone!.onusdMint,
      clone.provider.publicKey!
    ),
    getOrCreateAssociatedTokenAccount(
      clone.provider,
      clone.clone!.onusdMint,
      clone.clone!.treasuryAddress
    ),
  ]);

  let userIassetAccounts = await Promise.all(
    tokenData.pools.slice(0, tokenData.numPools.toNumber()).map((pool) => {
      return getOrCreateAssociatedTokenAccount(
        clone.provider,
        pool.assetInfo.iassetMint,
        clone.provider.publicKey!
      );
    })
  );

  let treasuryIassetAccounts = await Promise.all(
    tokenData.pools.slice(0, tokenData.numPools.toNumber()).map((pool) => {
      return getOrCreateAssociatedTokenAccount(
        clone.provider,
        pool.assetInfo.iassetMint,
        clone.clone!.treasuryAddress
      );
    })
  );

  return {
    userUsdi: userUsdi.address,
    userIassets: userIassetAccounts.map((a) => a.address),
    treasuryUsdi: treasuryUsdi.address,
    treasuryIasset: treasuryIassetAccounts.map((a) => a.address),
  };
};

const main = async () => {
  let config = {
    cloneProgramID: process.env.INCEPT_PROGRAM_ID!,
    pctThreshold: 0.01,
  };
  let provider = anchor.AnchorProvider.env();
  const client = new CloneClient(
    new PublicKey(config.cloneProgramID),
    provider
  );
  await client.loadManager();

  const accounts = await fetchAccounts(client);

  await pegPrices(client, accounts, config.pctThreshold);
};

main();
