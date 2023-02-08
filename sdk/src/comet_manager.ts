import {
    PublicKey,
  } from "@solana/web3.js";
  import { BN } from "@project-serum/anchor";

  export interface ManagerInfo {
    inceptProgram: PublicKey;
    incept: PublicKey;
    owner: PublicKey;
    membershipTokenSupply: BN;
    userAccount: PublicKey;
    userBump: number;
    bump: number;
    healthScoreThreshold: number;
    inClosingSequence: boolean;
    terminationSlot: BN,
    withdrawalFeeBps: number;
    managementFeeBps: number;
    feeClaimSlot: BN;
}

export interface Subscriber {
    owner: PublicKey;
    manager: PublicKey;
    principal: BN;
    membershipTokens: BN
}