import {
  TokenData,
  Comet,
} from "../generated/clone";
import { fromCloneScale, fromScale } from "./clone";

export const getEffectiveUSDCollateralValue = (
  tokenData: TokenData,
  comet: Comet
) => {
  // Iterate through collaterals.
  let effectiveUSDCollateral = 0;

  comet.collaterals
    .slice(0, Number(comet.numCollaterals))
    .forEach((cometCollateral) => {
      let collateralIndex = Number(cometCollateral.collateralIndex)
      const collateral =
        tokenData.collaterals[collateralIndex];
      const collateralAmount = fromScale(cometCollateral.collateralAmount, collateral.scale);
      
      if (collateralIndex === 0 || collateralIndex === 1) {
        effectiveUSDCollateral += collateralAmount
      } else {
        const oracle = tokenData.oracles[Number(collateral.oracleInfoIndex)];
        const oraclePrice = fromScale(oracle.price, oracle.expo);
        effectiveUSDCollateral +=
          (oraclePrice * collateralAmount) /
          fromScale(collateral.collateralizationRatio, 2);
      }
    });

  return effectiveUSDCollateral;
};

export const getHealthScore = (
  tokenData: TokenData,
  comet: Comet,
  oraclePrices?: number[]
): {
  healthScore: number;
  ildHealthImpact: number;
} => {
  const totalCollateralAmount = getEffectiveUSDCollateralValue(
    tokenData,
    comet
  );
  const positionILD = getILD(tokenData, comet, oraclePrices);
  let totalIldHealthImpact = 0;

  const loss =
    comet.positions
      .slice(0, Number(comet.numPositions))
      .map((position, index) => {
        const positionCommitted = fromCloneScale(position.committedOnusdLiquidity);
        const { onAssetILD, onusdILD, poolIndex, oraclePrice } =
          positionILD[index];
        const pool = tokenData.pools[poolIndex];

        let ilHealthScoreCoefficient = fromCloneScale(
          pool.assetInfo.ilHealthScoreCoefficient
        );
        let poolHealthScoreCoefficient = fromCloneScale(
          pool.assetInfo.positionHealthScoreCoefficient
        );

        let ild = Math.max(onusdILD, 0) + Math.max(onAssetILD * oraclePrice, 0);
        let ilHealthImpact = ild * ilHealthScoreCoefficient;
        let positionHealthImpact =
          poolHealthScoreCoefficient * positionCommitted;

        totalIldHealthImpact += ilHealthImpact;

        return positionHealthImpact + ilHealthImpact;
      })
      .reduce((partialSum, a) => partialSum + a, 0) / totalCollateralAmount;

  return {
    healthScore: 100 - loss,
    ildHealthImpact: totalIldHealthImpact / totalCollateralAmount,
  };
};

export const getILD = (
  tokenData: TokenData,
  comet: Comet,
  oraclePrices?: number[]
): {
  onAssetILD: number;
  onusdILD: number;
  poolIndex: number;
  oraclePrice: number;
}[] => {
  let results: {
    onAssetILD: number;
    onusdILD: number;
    poolIndex: number;
    oraclePrice: number;
  }[] = [];

  comet.positions.slice(0, Number(comet.numPositions)).forEach((position) => {
    const pool = tokenData.pools[Number(position.poolIndex)];
    const poolCommittedOnusd = fromCloneScale(pool.committedOnusdLiquidity);
    const oracle = tokenData.oracles[pool.assetInfo.oracleInfoIndex];

    const L =
      poolCommittedOnusd > 0
        ? fromCloneScale(position.committedOnusdLiquidity) / poolCommittedOnusd
        : 0;
    const onusdILD =
      L * fromCloneScale(pool.onusdIld) - fromCloneScale(position.onusdIldRebate);
    const onAssetILD =
      L * fromCloneScale(pool.onassetIld) - fromCloneScale(position.onassetIldRebate);
    results.push({
      onAssetILD,
      onusdILD,
      oraclePrice: oraclePrices
        ? oraclePrices[pool.assetInfo.oracleInfoIndex]
        : fromScale(oracle.price, oracle.expo),
      poolIndex: Number(position.poolIndex),
    });
  });

  return results;
};
