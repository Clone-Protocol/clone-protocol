import * as anchor from "@project-serum/anchor";
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
  incept: InceptClient,
  userBorrows: BorrowPositions,
  poolIndex: number,
  percentThreshold: number,
  accounts: TokenAccounts
): Promise<TransactionInstruction[]> => {
  const tokenData = await incept.getTokenData();
  let pool = tokenData.pools[poolIndex];

  let poolUsdi = toNumber(pool.usdiAmount);
  let poolIasset = toNumber(pool.iassetAmount);
  let poolPrice = poolUsdi / poolIasset;
  let oraclePrice = toNumber(pool.assetInfo.price);

  if (Math.abs(poolPrice - oraclePrice) / oraclePrice <= percentThreshold)
    return [];

  let ixCalls: Promise<TransactionInstruction>[] = [];
  ixCalls.push(incept.updatePricesInstruction());

  // Mint extra usdi if required.
  let usdiAccount = await getAccount(
    incept.provider.connection,
    accounts.userUsdi
  );
  let usdiBalance = Number(usdiAccount.amount) * 10 ** -DEVNET_TOKEN_SCALE;

  const adjustedIassetRatio = Math.sqrt((poolUsdi * poolIasset) / oraclePrice);

  if (oraclePrice > poolPrice) {
    // Need to buy iasset
    let iassetRequiredToBuy = poolIasset - adjustedIassetRatio;
    let usdiRequired = calculateInputFromOutput(
      pool,
      iassetRequiredToBuy,
      false
    );
    if (usdiRequired > usdiBalance) {
      ixCalls.push(
        incept.hackathonMintUsdiInstruction(
          accounts.userUsdi,
          toDevnetScale(usdiRequired - usdiBalance).toNumber()
        )
      );
    }

    ixCalls.push(
      incept.buyIassetInstruction(
        accounts.userUsdi,
        accounts.userIassets[poolIndex],
        toDevnetScale(iassetRequiredToBuy),
        poolIndex,
        toDevnetScale(usdiRequired * 1.1),
        accounts.treasuryIasset[poolIndex]
      )
    );
  } else {
    let iassetRequiredToSell = adjustedIassetRatio - poolIasset;
    let usdiRequiredforMint = 2 * iassetRequiredToSell * oraclePrice;

    if (usdiRequiredforMint > usdiBalance) {
      ixCalls.push(
        incept.hackathonMintUsdiInstruction(
          accounts.userUsdi,
          toDevnetScale(usdiRequiredforMint * 1.1 - usdiBalance).toNumber()
        )
      );
    }

    let usdiGained = calculateOutputFromInput(
      pool,
      iassetRequiredToSell,
      false
    );

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
        incept.initializeBorrowPositionInstruction(
          accounts.userUsdi,
          accounts.userIassets[poolIndex],
          toDevnetScale(iassetRequiredToSell),
          toDevnetScale(usdiRequiredforMint),
          poolIndex,
          0
        )
      );
    } else {
      ixCalls.push(
        incept.addCollateralToBorrowInstruction(
          borrowPositionIndex,
          accounts.userUsdi,
          toDevnetScale(usdiRequiredforMint)
        )
      );
      ixCalls.push(
        incept.subtractIassetFromBorrowInstruction(
          accounts.userIassets[poolIndex],
          toDevnetScale(iassetRequiredToSell),
          borrowPositionIndex
        )
      );
    }

    ixCalls.push(
      incept.sellIassetInstruction(
        accounts.userUsdi,
        accounts.userIassets[poolIndex],
        toDevnetScale(iassetRequiredToSell),
        poolIndex,
        toDevnetScale(usdiGained * 0.9),
        accounts.treasuryUsdi
      )
    );
  }

  let ixs = await Promise.all(ixCalls);
  return ixs;
};

const pegPrices = async (
  incept: InceptClient,
  accounts: TokenAccounts,
  pctThreshold: number
) => {
  await incept.updatePrices();
  const tokenData = await incept.getTokenData();
  const userAccount = await incept.getUserAccount();

  if (userAccount.borrowPositions.equals(anchor.web3.PublicKey.default)) {
    const borrowPositionsKeypair = anchor.web3.Keypair.generate();
    console.log("Generating borrow position account:", borrowPositionsKeypair.publicKey.toString())
    let tx = new Transaction();
    tx.add(
      await incept.initializeBorrowPositionsAccountInstruction(
        borrowPositionsKeypair
      )
    );
    await incept.provider.sendAndConfirm!(tx);
    await sleep(4000);
  }

  const userBorrows = await incept.getBorrowPositions();

  for (
    let poolIndex = 0;
    poolIndex < tokenData.numPools.toNumber();
    poolIndex++
  ) {
    let ixs = await generatePeggingInstructions(
      incept,
      userBorrows,
      poolIndex,
      pctThreshold,
      accounts
    );

    if (ixs.length === 0) continue;

    let tx = new Transaction();

    ixs.forEach((ix) => tx.add(ix));

    await incept.provider.sendAndConfirm!(tx, []);
    console.log("Price pegged for pool:", poolIndex);
  }
};

const fetchAccounts = async (incept: InceptClient): Promise<TokenAccounts> => {
  const tokenData = await incept.getTokenData();

  let [userUsdi, treasuryUsdi] = await Promise.all([
    getOrCreateAssociatedTokenAccount(
      incept.provider,
      incept.incept!.usdiMint,
      incept.provider.publicKey!
    ),
    getOrCreateAssociatedTokenAccount(
      incept.provider,
      incept.incept!.usdiMint,
      incept.incept!.treasuryAddress
    ),
  ]);

  let userIassetAccounts = await Promise.all(
    tokenData.pools.slice(0, tokenData.numPools.toNumber()).map((pool) => {
      return getOrCreateAssociatedTokenAccount(
        incept.provider,
        pool.assetInfo.iassetMint,
        incept.provider.publicKey!
      );
    })
  );

  let treasuryIassetAccounts = await Promise.all(
    tokenData.pools.slice(0, tokenData.numPools.toNumber()).map((pool) => {
      return getOrCreateAssociatedTokenAccount(
        incept.provider,
        pool.assetInfo.iassetMint,
        incept.incept!.treasuryAddress
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
    inceptProgramID: "2YSThxfPwJWYPAeBczUqbu2cyefjq9vAdDsPJU7PUVak",
    pctThreshold: 0.01,
  };
  let provider = anchor.AnchorProvider.env();
  const client = new InceptClient(
    new PublicKey(config.inceptProgramID),
    provider
  );
  await client.loadManager();

  const accounts = await fetchAccounts(client);

  await pegPrices(client, accounts, config.pctThreshold);
};

main();
