import anchor from "@coral-xyz/anchor";
import { createInitializeMintInstruction, getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Comet, Clone as CloneAccount, Pools, Oracles } from "../sdk/generated/clone";
import { fromCloneScale, fromScale } from "../sdk/src/clone";
import { getHealthScore, getILD } from "../sdk/src/healthscore";
import { calculateSwapExecution, InsufficientLiquidityError } from "../sdk/src/utils";
import { Transaction, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";

export const createTokenMint = async (
  provider: anchor.AnchorProvider,
  opts: { mint?: Keypair; scale?: number; authority?: PublicKey }
): Promise<PublicKey> => {
  let tokenMint = opts.mint ?? Keypair.generate();
  let tx = new Transaction().add(
    // create cln mint account
    SystemProgram.createAccount({
      fromPubkey: provider.publicKey!,
      newAccountPubkey: tokenMint.publicKey,
      space: MINT_SIZE,
      lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
      programId: TOKEN_PROGRAM_ID,
    }),
    // init clone mint account
    createInitializeMintInstruction(
      tokenMint.publicKey,
      opts.scale ?? 8,
      opts.authority ?? provider.publicKey!,
      null
    )
  );
  await provider.sendAndConfirm(tx, [tokenMint]);
  return tokenMint.publicKey;
};


export const calculateLiquidationAttacks = (comet: Comet, clone: CloneAccount, pools: Pools, oracles: Oracles, oraclePrices?: number[]) => {
    // Calculate current health score
    const { healthScore, effectiveCollateralValue } = getHealthScore(oracles, pools, comet, clone.collateral, oraclePrices);
    const positionILD = getILD(clone.collateral, pools, oracles, comet, oraclePrices);
    // For each position, calculate the amount of additional ILD required to put the entire Comet at liquidation risk.
    const attackPotentials = comet.positions.map((position, i) => {
        const pool = pools.pools[position.poolIndex];
        const { onAssetILD, oraclePrice } = positionILD[i];
        const poolCommittedCollateralLiquidity = fromScale(pool.committedCollateralLiquidity, clone.collateral.scale);
        const L = fromScale(position.committedCollateralLiquidity, clone.collateral.scale) / poolCommittedCollateralLiquidity;
        // The additional ILD incurred for this position to put comet at risk.
        const ildHealthScoreCoeff = fromScale(pool.assetInfo.ilHealthScoreCoefficient, 2);
        const additionalILDForLiquidationRisk = effectiveCollateralValue * healthScore / ildHealthScoreCoeff
        let costToAttack: number | undefined = undefined;
        let amountToBuy = 0;

        if (healthScore > 0) {
            // How much an attacker would need to buy pull out from the pool.
            amountToBuy = (additionalILDForLiquidationRisk / oraclePrice) / L;

            try {
                const executionEst = calculateSwapExecution(
                    amountToBuy,
                    false,
                    false,
                    fromScale(pool.collateralIld, clone.collateral.scale),
                    fromCloneScale(pool.onassetIld),
                    poolCommittedCollateralLiquidity,
                    fromScale(pool.liquidityTradingFeeBps, 4),
                    fromScale(pool.treasuryTradingFeeBps, 4),
                    oraclePrice,
                    clone.collateral
                );
                costToAttack = executionEst.result;
            } catch (e) {}
        } else {
            costToAttack = 0;
        }
        
        const totalProjectedILD = onAssetILD + additionalILDForLiquidationRisk / oraclePrice;
        const liquidationReward = (oraclePrice * totalProjectedILD) * (1 + fromScale(clone.cometOnassetIldLiquidatorFeeBps, 4));
        return { costToAttack, liquidationReward, amountToBuy, totalProjectedILD }
    });
    
    const profitableAttack = attackPotentials.findIndex((potential) => potential.costToAttack ?? Number.MAX_SAFE_INTEGER < potential.liquidationReward);
  
    return {
        profitableAttack,
        attackPotentials
    }
  }