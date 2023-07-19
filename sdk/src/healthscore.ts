import { TokenData, Comet } from "./interfaces";
import { toNumber } from "./decimal";
import {
  TokenData as SolitaTokenData,
  Comet as SolitaComet,
  CometPosition,
} from "../generated/clone/index";

export const getEffectiveUSDCollateralValue = (
  tokenData: TokenData | SolitaTokenData,
  comet: Comet | SolitaComet
) => {
  // Iterate through collaterals.
  let effectiveUSDCollateral = 0;

  comet.collaterals
    .slice(0, Number(comet.numCollaterals))
    .forEach((cometCollateral) => {
      const collateral =
        tokenData.collaterals[Number(cometCollateral.collateralIndex)];
      if (Number(collateral.stable) === 1) {
        effectiveUSDCollateral += toNumber(cometCollateral.collateralAmount);
      } else {
        const oracle = tokenData.oracles[Number(collateral.oracleInfoIndex)];
        const oraclePrice = toNumber(oracle.price);
        effectiveUSDCollateral +=
          (oraclePrice * toNumber(cometCollateral.collateralAmount)) /
          toNumber(collateral.collateralizationRatio);
      }
    });

  return effectiveUSDCollateral;
};

export const getHealthScore = (
  tokenData: TokenData | SolitaTokenData,
  comet: Comet | SolitaComet,
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
        const positionCommitted = toNumber(position.committedOnusdLiquidity);
        const { onAssetILD, onusdILD, poolIndex, oraclePrice } =
          positionILD[index];
        const pool = tokenData.pools[poolIndex];

        let ilHealthScoreCoefficient = toNumber(
          pool.assetInfo.ilHealthScoreCoefficient
        );
        let poolHealthScoreCoefficient = toNumber(
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
  tokenData: TokenData | SolitaTokenData,
  comet: Comet | SolitaComet,
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
    const poolCommittedOnusd = toNumber(pool.committedOnusdLiquidity);
    const oracle = tokenData.oracles[pool.assetInfo.oracleInfoIndex];

    const L =
      poolCommittedOnusd > 0
        ? toNumber(position.committedOnusdLiquidity) / poolCommittedOnusd
        : 0;
    const onusdILD =
      L * toNumber(pool.onusdIld) - toNumber(position.onusdIldRebate);
    const onAssetILD =
      L * toNumber(pool.onassetIld) - toNumber(position.onassetIldRebate);
    results.push({
      onAssetILD,
      onusdILD,
      oraclePrice: oraclePrices
        ? oraclePrices[pool.assetInfo.oracleInfoIndex]
        : toNumber(oracle.price),
      poolIndex: Number(position.poolIndex),
    });
  });

  return results;
};
