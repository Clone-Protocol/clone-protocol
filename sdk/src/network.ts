import { PublicKey } from "@solana/web3.js";

export enum Network {
  DEV,
  TEST,
  MAIN,
  LOCAL,
}

export const LOCAL_NET = {
  clone: new PublicKey("3j5wcCkkjns9wibgXVNAay3gzjZiVvYUbW66vqvjEaS7"),
  oracle: new PublicKey("9MZD2G6NXoYpHiTECYvxWa5cDpCJ6bbyuucxEaGvhAtY"),
  exchangeAuthority: new PublicKey(
    "DmhNzyGk93utgYYR41hRJWJzKtFKUYt4UR3bZFbVAD4i"
  ),
  endpoint: "http://127.0.0.1:8899",
};
export const DEV_NET = {
  clone: new PublicKey("HcyCw29qWC77CTnmJkwjnW1whbTppv4xh2SQQzjMin55"),
  oracle: new PublicKey("DUTaRHQcejLHkDdsnR8cUUv2BakxCJfJQmWQNK2hzizE"),
  exchangeAuthority: new PublicKey(
    "6dcLU83ferGcEAjeUeLuJ8q7JbSV2vK3EGajW895tZBj"
  ),
  endpoint: "https://explorer-api.devnet.solana.com",
};
export const TEST_NET = {
  clone: new PublicKey("HcyCw29qWC77CTnmJkwjnW1whbTppv4xh2SQQzjMin55"),
  oracle: new PublicKey("4nopYr9nYL5MN1zVgvQQfLhDdqAyVHtR5ZkpPcS12M5b"),
  exchangeAuthority: new PublicKey(
    "6dcLU83ferGcEAjeUeLuJ8q7JbSV2vK3EGajW895tZBj"
  ),
  endpoint: "http://127.0.0.1:8899",
};
export const MAIN_NET = {
  clone: new PublicKey("5TeGDBaMNPc2uxvx6YLDycsoxFnBuqierPt3a8Bk4xFX"),
  oracle: new PublicKey("4nopYr9nYL5MN1zVgvQQfLhDdqAyVHtR5ZkpPcS12M5b"),
  exchangeAuthority: new PublicKey(
    "4f1XgkC1dSvvovZ9EU85pY8pwNdJRhqy7jjq188b1DjJ"
  ),
  endpoint: "http://127.0.0.1:8899",
};

/**
 * Pulls which network to use (LOCAL_NET, DEV_NET) from the environment variable `USE_NETWORK`.
 * DEV_NET can be activated by setting `USE_NETWORK='DEV_NET'` otherwise defaults to LOCAL_NET.
 *
 * @returns { PublicKey, PublicKey, string }
 *
 */
export const getNetworkDetailsFromEnv = () => {
  let details = LOCAL_NET;

  if (process.env.NEXT_PUBLIC_USE_NETWORK) {
    if (process.env.NEXT_PUBLIC_USE_NETWORK.toLowerCase() === "dev_net") {
      details = DEV_NET;
    }
  }

  if (process.env.NEXT_PUBLIC_CLONE_PROGRAM_ID) {
    details.clone = new PublicKey(process.env.NEXT_PUBLIC_CLONE_PROGRAM_ID);
  }

  if (process.env.NEXT_PUBLIC_NETWORK_ENDPOINT) {
    details.endpoint = process.env.NEXT_PUBLIC_NETWORK_ENDPOINT;
  }

  return details;
};
