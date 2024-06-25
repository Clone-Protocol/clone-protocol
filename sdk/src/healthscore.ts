import { Pools, Comet, Collateral, Oracles } from "../generated/clone";
import { CLONE_TOKEN_SCALE, fromCloneScale, fromScale } from "./clone";
import { floorToScale, floortoCloneScale } from "./utils";

export const getEffectiveCollateralValue = (
  comet: Comet,
  collateral: Collateral
) => {
  return (
    fromScale(comet.collateralAmount, collateral.scale) *
    fromScale(collateral.collateralizationRatio, 2)
  );
};

export const getHealthScore = (
  oracles: Oracles,
  pools: Pools,
  comet: Comet,
  collateral: Collateral,
  oraclePrices?: number[]
): {
  healthScore: number;
  loss: number;
  ildImpact: number;
  positionImpact: number;
  ildHealthImpact: number;
  positionHealthImpact: number;
  effectiveCollateralValue: number;
} => {
  const totalCollateralValue = getEffectiveCollateralValue(comet, collateral);
  const positionILD = getILD(collateral, pools, oracles, comet, oraclePrices);
  let ildImpact = 0;
  let positionImpact = 0;

  comet.positions
    .forEach((position, index) => {
      const positionCommitted = fromScale(
        position.committedCollateralLiquidity,
        collateral.scale
      );
      const { onAssetILD, collateralILD, poolIndex, oraclePrice } =
        positionILD[index];
      const pool = pools.pools[poolIndex];

      let ilHealthScoreCoefficient = fromScale(
        pool.assetInfo.ilHealthScoreCoefficient,
        2
      );
      let poolHealthScoreCoefficient = fromScale(
        pool.assetInfo.positionHealthScoreCoefficient,
        2
      );

      let ild =
        Math.max(collateralILD, 0) + Math.max(onAssetILD * oraclePrice, 0);
      let ilHealthImpact = ild * ilHealthScoreCoefficient;
      let positionHealthImpact =
        poolHealthScoreCoefficient * positionCommitted;

        ildImpact += ilHealthImpact;
        positionImpact += positionHealthImpact;

      return positionHealthImpact + ilHealthImpact;
    })
  const loss = ildImpact + positionImpact

  return {
    healthScore: 100 * (1. - loss / totalCollateralValue),
    loss,
    ildImpact,
    positionImpact,
    ildHealthImpact: ildImpact / totalCollateralValue,
    positionHealthImpact: positionImpact / totalCollateralValue,
    effectiveCollateralValue: totalCollateralValue,
  };
};

export const getILD = (
  collateral: Collateral,
  pools: Pools,
  oracles: Oracles,
  comet: Comet,
  oraclePrices?: number[]
): {
  onAssetILD: number;
  collateralILD: number;
  poolIndex: number;
  oraclePrice: number;
}[] => {
  let results: {
    onAssetILD: number;
    collateralILD: number;
    poolIndex: number;
    oraclePrice: number;
  }[] = [];

  comet.positions.forEach((position) => {
    const pool = pools.pools[Number(position.poolIndex)];
    const poolCommittedOnusd = fromScale(
      pool.committedCollateralLiquidity,
      collateral.scale
    );

    const oraclePrice = (() => {
      const assetOracleIndex = Number(pool.assetInfo.oracleInfoIndex);
      const collateralOracleIndex = Number(collateral.oracleInfoIndex);
      if (oraclePrices) {
        return (
          oraclePrices[assetOracleIndex] / oraclePrices[collateralOracleIndex]
        );
      } else {
        const assetOracle = oracles.oracles[assetOracleIndex];
        const rescaleFactor = Math.pow(10, assetOracle.rescaleFactor);
        const collateralOracle = oracles.oracles[collateralOracleIndex];
        return (
          rescaleFactor * fromScale(assetOracle.price, assetOracle.expo) /
          fromScale(collateralOracle.price, collateralOracle.expo)
        );
      }
    })();

    const L =
      poolCommittedOnusd > 0
        ? fromScale(position.committedCollateralLiquidity, collateral.scale) /
          poolCommittedOnusd
        : 0;

    const collateralILDClaim =
      L * fromScale(pool.collateralIld, collateral.scale);

    const collateralILD = floorToScale(
      collateralILDClaim -
        fromScale(position.collateralIldRebate, collateral.scale),
      collateral.scale
    );

    const onAssetILDClaim = floortoCloneScale(
      L * fromCloneScale(pool.onassetIld)
    );
    const onAssetILD = floortoCloneScale(
      onAssetILDClaim - fromCloneScale(position.onassetIldRebate)
    );

    results.push({
      onAssetILD,
      collateralILD,
      oraclePrice,
      poolIndex: Number(position.poolIndex),
    });
  });

  return results;
};
