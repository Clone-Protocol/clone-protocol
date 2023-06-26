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
import { Clone, User, TokenData } from "../../sdk/generated/clone/index";
import { Jupiter } from "../../sdk/generated/jupiter-agg-mock";
import { ManagerInfo } from "../../sdk/generated/clone-comet-manager";

export interface TokenAccountAddresses {
  onassetToken: PublicKey[];
  underlyingToken?: PublicKey[];
  onusdToken: PublicKey;
  usdcToken: PublicKey;
}

export const getManagerTokenAccountAddresses = async (
  provider: anchor.AnchorProvider,
  managerAddress: PublicKey,
  tokenData: TokenData,
  onusdMint: PublicKey,
  usdcMint: PublicKey,
  underlyingMints: PublicKey[]
): Promise<TokenAccountAddresses> => {
  const nPools = Number(tokenData.numPools!);

  const onassetMints = tokenData.pools.slice(0, nPools).map((pool) => {
    return pool.assetInfo.onassetMint;
  });

  let onassetToken: PublicKey[] = [];
  for (const mint of onassetMints) {
    console.log("MANAGER IASSET MINT:", mint.toString());
    const associatedToken = await getAssociatedTokenAddress(
      mint,
      managerAddress,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    onassetToken.push(associatedToken);
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

  const onusdToken = await getAssociatedTokenAddress(
    onusdMint,
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
    onassetToken,
    underlyingToken,
    onusdToken,
    usdcToken,
  };
};

export const getTreasuryTokenAccountAddresses = async (
  provider: anchor.AnchorProvider,
  treasuryAddress: PublicKey,
  tokenData: TokenData,
  onusdMint: PublicKey,
  usdcMint: PublicKey
): Promise<TokenAccountAddresses> => {
  const nPools = Number(tokenData.numPools!);

  const onassetMints = tokenData.pools.slice(0, nPools).map((pool) => {
    return pool.assetInfo.onassetMint;
  });

  let onassetToken: PublicKey[] = [];
  for (const mint of onassetMints) {
    console.log("TREASURY IASSET MINT:", mint.toString());
    const associatedToken = await getAssociatedTokenAddress(
      mint,
      treasuryAddress,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    onassetToken.push(associatedToken);
  }
  const onusdToken = await getAssociatedTokenAddress(
    onusdMint,
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
    onassetToken,
    onusdToken,
    usdcToken,
  };
};

export const setupAddressLookupTable = async (
  provider: anchor.AnchorProvider,
  clone: Clone,
  cloneAccountAddress: PublicKey,
  managerInfo: ManagerInfo,
  managerAddresses: TokenAccountAddresses,
  managerInfoAddress: PublicKey,
  managerCloneUser: User,
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
    cloneAccountAddress,
    clone.tokenData,
    clone.treasuryAddress,
    clone.onusdMint,
    jupiterAddress,
    jupiterProgramId,
    managerInfo.clone,
    managerInfo.cloneProgram,
    managerInfo.userAccount,
    managerAddresses.usdcToken,
    managerAddresses.onusdToken,
    ...managerAddresses.onassetToken,
    ...managerAddresses.underlyingToken!,
    managerInfoAddress,
    managerCloneUser.comet,
    managerCloneUser.authority,
    tokenData.collaterals[0].vault,
    treasuryAddresses.usdcToken,
    treasuryAddresses.onusdToken,
    ...treasuryAddresses.onassetToken,
  ];

  tokenData.pools.slice(0, Number(tokenData.numPools)).forEach((pool) => {
    addresses.push(pool.onassetTokenAccount);
    addresses.push(pool.onusdTokenAccount);
    addresses.push(pool.assetInfo.onassetMint);
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
