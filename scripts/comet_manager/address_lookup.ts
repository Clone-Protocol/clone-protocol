import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
  AddressLookupTableProgram,
} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "../../tests/utils";
import { Incept, User, TokenData } from "../../sdk/generated/incept/index";
import { Jupiter } from "../../sdk/generated/jupiter-agg-mock";
import { ManagerInfo } from "../../sdk/generated/incept-comet-manager";

export interface TokenAccountAddresses {
  iassetToken: PublicKey[];
  underlyingToken?: PublicKey[];
  usdiToken: PublicKey;
  usdcToken: PublicKey;
}

export const getManagerTokenAccountAddresses = async (
  provider: anchor.AnchorProvider,
  managerAddress: PublicKey,
  tokenData: TokenData,
  usdiMint: PublicKey,
  usdcMint: PublicKey,
  underlyingMints: PublicKey[]
): Promise<TokenAccountAddresses> => {
  const nPools = Number(tokenData.numPools!);

  const iassetMints = tokenData.pools.slice(0, nPools).map((pool) => {
    return pool.assetInfo.iassetMint;
  });

  let iassetToken: PublicKey[] = [];
  for (const mint of iassetMints) {
    console.log("MANAGER IASSET MINT:", mint.toString());
    const associatedToken = await getAssociatedTokenAddress(
      mint,
      managerAddress,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    iassetToken.push(associatedToken);
  }

  let underlyingToken: PublicKey[] = [];
  for (const mint of underlyingMints) {
    console.log("MANAGER UNDERLYING MINT:", mint.toString());
    const associatedToken = await getAssociatedTokenAddress(
      mint,
      managerAddress,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    underlyingToken.push(associatedToken);
  }

  const usdiToken = await getAssociatedTokenAddress(
    usdiMint,
    managerAddress,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const usdcToken = await getAssociatedTokenAddress(
    usdcMint,
    managerAddress,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return {
    iassetToken,
    underlyingToken,
    usdiToken,
    usdcToken,
  };
};

export const getTreasuryTokenAccountAddresses = async (
  provider: anchor.AnchorProvider,
  treasuryAddress: PublicKey,
  tokenData: TokenData,
  usdiMint: PublicKey,
  usdcMint: PublicKey
): Promise<TokenAccountAddresses> => {
  const nPools = Number(tokenData.numPools!);

  const iassetMints = tokenData.pools.slice(0, nPools).map((pool) => {
    return pool.assetInfo.iassetMint;
  });

  let iassetToken: PublicKey[] = [];
  for (const mint of iassetMints) {
    console.log("TREASURY IASSET MINT:", mint.toString());
    const associatedToken = await getAssociatedTokenAddress(
      mint,
      treasuryAddress,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    iassetToken.push(associatedToken);
  }
  const usdiToken = await getAssociatedTokenAddress(
    usdiMint,
    treasuryAddress,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const usdcToken = await getAssociatedTokenAddress(
    usdcMint,
    treasuryAddress,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return {
    iassetToken,
    usdiToken,
    usdcToken,
  };
};

export const setupAddressLookupTable = async (
  provider: anchor.AnchorProvider,
  incept: Incept,
  inceptAccountAddress: PublicKey,
  managerInfo: ManagerInfo,
  managerAddresses: TokenAccountAddresses,
  managerInfoAddress: PublicKey,
  managerInceptUser: User,
  tokenData: TokenData,
  treasuryAddresses: TokenAccountAddresses,
  jupiter: Jupiter,
  jupiterAddress: PublicKey,
  jupiterProgramId: PublicKey
): Promise<[anchor.web3.AddressLookupTableAccount, anchor.web3.PublicKey]> => {
  const userKey = provider.publicKey!;

  const slot = await provider.connection.getSlot("finalized");
  const [lookupTableInst, altAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: userKey,
      payer: userKey,
      recentSlot: slot,
    });

  await provider.sendAndConfirm(new Transaction().add(lookupTableInst));
  console.log("ADDRESS LOOKUP TABLE CREATED AT:", altAddress.toString());

  // Collect addresses
  let addresses: PublicKey[] = [
    userKey,
    anchor.web3.SystemProgram.programId,
    TOKEN_PROGRAM_ID,
    inceptAccountAddress,
    incept.tokenData,
    incept.treasuryAddress,
    incept.usdiMint,
    jupiterAddress,
    jupiterProgramId,
    managerInfo.incept,
    managerInfo.inceptProgram,
    managerInfo.userAccount,
    managerAddresses.usdcToken,
    managerAddresses.usdiToken,
    ...managerAddresses.iassetToken,
    ...managerAddresses.underlyingToken!,
    managerInfoAddress,
    managerInceptUser.comet,
    managerInceptUser.authority,
    tokenData.collaterals[0].vault,
    treasuryAddresses.usdcToken,
    treasuryAddresses.usdiToken,
    ...treasuryAddresses.iassetToken,
  ];

  tokenData.pools.slice(0, Number(tokenData.numPools)).forEach((pool) => {
    addresses.push(pool.iassetTokenAccount);
    addresses.push(pool.usdiTokenAccount);
    addresses.push(pool.assetInfo.iassetMint);
    addresses.push(pool.liquidityTokenMint);
    addresses.push(pool.cometLiquidityTokenAccount);
    addresses.push(pool.underlyingAssetTokenAccount);
  });

  for (let i = 0; i < jupiter.nAssets; i++) {
    addresses.push(jupiter.assetMints[i]);
    addresses.push(jupiter.oracles[i]);
  }

  const batchSize = 20;

  for (let i = 0; i < Math.ceil(addresses.length / batchSize); i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, addresses.length);
    const extendInstruction = AddressLookupTableProgram.extendLookupTable({
      payer: userKey,
      authority: userKey,
      lookupTable: altAddress,
      addresses: addresses.slice(start, end),
    });
    await provider.sendAndConfirm(new Transaction().add(extendInstruction));
  }

  const account = (await provider.connection
    .getAddressLookupTable(altAddress)
    .then((res) => res.value))!;

  return [account, altAddress];
};
