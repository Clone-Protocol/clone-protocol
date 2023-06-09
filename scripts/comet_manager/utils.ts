import { PublicKey, Keypair } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import {
  Clone,
  User,
  TokenData,
  createUpdatePricesInstruction,
} from "../../sdk/generated/clone/index";
import { AnchorProvider } from "@coral-xyz/anchor";
import { getOrCreateAssociatedTokenAccount } from "../../tests/utils";
import {
  createUpdateNetValueInstruction,
  ManagerInfo,
} from "../../sdk/generated/clone-comet-manager";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { fromEnv } from "@aws-sdk/credential-provider-env";

export const buildUpdatePricesInstruction = (
  cloneAccountAddress: PublicKey,
  tokenDataAddress: PublicKey,
  tokenData: TokenData
) => {
  let indices: number[] = [];
  let priceFeeds: Array<{
    pubkey: PublicKey;
    isWritable: boolean;
    isSigner: boolean;
  }> = [];

  tokenData.pools.slice(0, Number(tokenData.numPools)).forEach((_, i) => {
    indices.push(i);
    priceFeeds.push({
      pubkey: tokenData.pools[i].assetInfo.pythAddress,
      isWritable: false,
      isSigner: false,
    });
  });

  let zero_padding = 128 - indices.length;
  for (let i = 0; i < zero_padding; i++) {
    indices.push(0);
  }
  return createUpdatePricesInstruction(
    {
      clone: cloneAccountAddress,
      tokenData: tokenDataAddress,
      anchorRemainingAccounts: priceFeeds,
    },
    { poolIndices: { indices } }
  );
};

export const buildUpdateNetValueInstruction = async (
  provider: AnchorProvider,
  tokenData: TokenData,
  cometManagerInfoAddress: PublicKey,
  cloneAccountAddress: PublicKey,
  clone: Clone,
  managerOnonusdTokenAddress: PublicKey,
  managerUsdcTokenAddress: PublicKey,
  managerIassetTokenAddresses: PublicKey[],
  managerUnderlyingTokenAddress: PublicKey[],
  underlyingMintAddresses: PublicKey[]
) => {
  const managerInfo = await ManagerInfo.fromAccountAddress(
    provider.connection,
    cometManagerInfoAddress
  );
  const managerCloneUser = await User.fromAccountAddress(
    provider.connection,
    managerInfo.userAccount
  );
  const usdcMint = tokenData.collaterals[1].mint;
  const nPools = Number(tokenData.numPools);

  let remainingAccounts: PublicKey[] = [
    ...managerIassetTokenAddresses,
    ...managerUnderlyingTokenAddress,
    ...tokenData.pools
      .slice(0, nPools)
      .map((pool) => pool.underlyingAssetTokenAccount),
    ...underlyingMintAddresses,
  ];
  // let underlyingMints: PublicKey[] = [];
  // let underlyingAccounts: PublicKey[] = [];

  // managerIassetTokenAddresses.map((address, index) => {
  //   remainingAccounts.push(address)
  //   remainingAccounts.push()
  // })

  // for (
  //   let poolIndex = 0;
  //   poolIndex < nPools;
  //   poolIndex++
  // ) {
  //   let pool = tokenData.pools[poolIndex];
  //   let ata = await getOrCreateAssociatedTokenAccount(
  //     provider,
  //     pool.assetInfo.iassetMint,
  //     cometManagerInfoAddress,
  //     true
  //   );
  //   remainingAccounts.push(ata.address);

  //   let underlying = await getAccount(
  //     provider.connection,
  //     pool.underlyingAssetTokenAccount
  //   );
  //   underlyingMints.push(underlying.mint);
  //   let underlyingAta = await getOrCreateAssociatedTokenAccount(
  //     provider,
  //     underlying.mint,
  //     cometManagerInfoAddress,
  //     true
  //   );
  //   underlyingAccounts.push(underlyingAta.address);
  // }
  // underlyingAccounts.forEach((address) => remainingAccounts.push(address));

  // tokenData.pools.slice(0, nPools).forEach((pool) => {
  //   remainingAccounts.push(pool.underlyingAssetTokenAccount);
  // });
  // underlyingMints.forEach((pk) => remainingAccounts.push(pk));

  let updateNetValueIx = createUpdateNetValueInstruction({
    signer: provider.publicKey!,
    managerInfo: cometManagerInfoAddress,
    clone: cloneAccountAddress,
    managerCloneUser: managerInfo.userAccount,
    onusdMint: clone.onusdMint,
    usdcMint: usdcMint,
    comet: managerCloneUser.comet,
    tokenData: clone.tokenData,
    managerOnusdTokenAccount: managerOnonusdTokenAddress,
    managerUsdcTokenAccount: managerUsdcTokenAddress,
    anchorRemainingAccounts: remainingAccounts.map((pk) => {
      return { pubkey: pk, isSigner: false, isWritable: false };
    }),
  });
  return updateNetValueIx;
};

export const getKeypairFromAWSSecretsManager = async (
  secretName: string,
  region: string = "us-east-2"
) => {
  const client = new SecretsManagerClient({
    region,
    //credentials: fromEnv()
  });

  let response;

  try {
    response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      })
    );
  } catch (error) {
    console.log("ERROR RETRIEVING SECRETS FROM AWS");
    // For a list of exceptions thrown, see
    // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
    throw error;
  }

  return response.SecretString as string;
};

export const generateKeypairFromBuffer = (buffer: Uint8Array): Keypair => {
  return new Keypair({
    publicKey: buffer.slice(32, 64),
    secretKey: buffer.slice(0, 32),
  });
};
