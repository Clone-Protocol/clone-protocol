import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAccount } from "@solana/spl-token";
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

  const iassetToken = (
    await Promise.all(
      iassetMints.map((mint) => {
        return getOrCreateAssociatedTokenAccount(
          provider,
          mint,
          managerAddress,
          true
        );
      })
    )
  ).map((a) => a.address);

  const underlyingToken = (
    await Promise.all(
      underlyingMints.map((mint) => {
        return getOrCreateAssociatedTokenAccount(
          provider,
          mint,
          managerAddress,
          true
        );
      })
    )
  ).map((x) => x.address);

  const usdiToken = (
    await getOrCreateAssociatedTokenAccount(
      provider,
      usdiMint,
      managerAddress,
      true
    )
  ).address;
  const usdcToken = (
    await getOrCreateAssociatedTokenAccount(
      provider,
      usdcMint,
      managerAddress,
      true
    )
  ).address;

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

  const iassetToken = (
    await Promise.all(
      iassetMints.map((mint) => {
        return getOrCreateAssociatedTokenAccount(
          provider,
          mint,
          treasuryAddress,
          false
        );
      })
    )
  ).map((a) => a.address);

  const usdiAccount = await getOrCreateAssociatedTokenAccount(
    provider,
    usdiMint,
    treasuryAddress,
    false
  );
  console.log("treasury:", treasuryAddress.toString());
  console.log("USDI TREASURY:", usdiAccount.address.toString());
  console.log("USDI TREASURY OWNER:", usdiAccount.owner.toString());
  console.log("USDI TREASURY MINT:", usdiAccount.mint.toString());

  const usdiToken = (
    await getOrCreateAssociatedTokenAccount(
      provider,
      usdiMint,
      treasuryAddress,
      false
    )
  ).address;
  const usdcToken = (
    await getOrCreateAssociatedTokenAccount(
      provider,
      usdcMint,
      treasuryAddress,
      false
    )
  ).address;

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
