import { TokenData, Comet } from "./interfaces";
import { toNumber } from "./decimal";
import { CalculationError } from "./error";
import { floorToDevnetScale } from "./utils"
import { TokenData as SolitaTokenData, Comet as SolitaComet } from "../generated/clone/index"

export const getEffectiveUSDCollateralValue = (
  tokenData: TokenData | SolitaTokenData,
  comet: Comet | SolitaComet
) => {
  // Iterate through collaterals.
  let effectiveUSDCollateral = 0;

  comet.collaterals
    .slice(0, Number(comet.numCollaterals))
    .forEach((cometCollateral) => {
      const collateral = tokenData.collaterals[cometCollateral.collateralIndex];
      if (Number(collateral.stable) === 1) {
        effectiveUSDCollateral += toNumber(cometCollateral.collateralAmount);
      } else {
        const pool = tokenData.pools[Number(collateral.poolIndex)];
        const oraclePrice = toNumber(pool.assetInfo.price);
        effectiveUSDCollateral +=
          (oraclePrice * toNumber(cometCollateral.collateralAmount)) /
          toNumber(pool.assetInfo.cryptoCollateralRatio);
      }
    });

  return effectiveUSDCollateral;
};

export const getHealthScore = (
  tokenData: TokenData | SolitaTokenData,
  comet: Comet | SolitaComet
): {
  healthScore: number;
  ildHealthImpact: number;
} => {
  const totalCollateralAmount = getEffectiveUSDCollateralValue(
    tokenData,
    comet
  );
  let totalIldHealthImpact = 0;

  const loss =
    comet.positions
      .slice(0, Number(comet.numPositions))
      .map((position) => {
        let pool = tokenData.pools[position.poolIndex];
        let poolOnUsdAmount = toNumber(pool.onusdAmount);
        let poolOnAssetAmount = toNumber(pool.onassetAmount);
        let borrowedOnUsd = toNumber(position.borrowedOnusd);
        let borrowedOnAsset = toNumber(position.borrowedOnasset);

        let claimableRatio =
          toNumber(position.liquidityTokenValue) /
          toNumber(pool.liquidityTokenSupply);

        let claimableOnUsd = poolOnUsdAmount * claimableRatio;
        let claimableOnAsset = poolOnAssetAmount * claimableRatio;

        let ilHealthScoreCoefficient = toNumber(
          pool.assetInfo.ilHealthScoreCoefficient
        );
        let poolHealthScoreCoefficient = toNumber(
          pool.assetInfo.positionHealthScoreCoefficient
        );

        let ild = 0;
        if (borrowedOnUsd > claimableOnUsd) {
          ild += borrowedOnUsd - claimableOnUsd;
        }
        if (borrowedOnAsset > claimableOnAsset) {
          const onassetDebt = borrowedOnAsset - claimableOnAsset;
          const oracleMarked = toNumber(pool.assetInfo.price) * onassetDebt;
          ild += oracleMarked;
        }

        let ilHealthImpact = ild * ilHealthScoreCoefficient;
        let positionHealthImpact = poolHealthScoreCoefficient * borrowedOnUsd;

        totalIldHealthImpact += ilHealthImpact;

        return positionHealthImpact + ilHealthImpact;
      })
      .reduce((partialSum, a) => partialSum + a, 0) / totalCollateralAmount;

  return {
    healthScore: 100 - loss,
    ildHealthImpact: totalIldHealthImpact / totalCollateralAmount,
  };
};

export const getSinglePoolHealthScore = (
  cometIndex: number,
  tokenData: TokenData,
  comet: Comet
): { healthScore: number; ILD: number; ildInOnUsd: boolean } => {
  let position = comet.positions[cometIndex];
  let pool = tokenData.pools[position.poolIndex];
  let poolOnUsdAmount = toNumber(pool.onusdAmount);
  let poolOnAssetAmount = toNumber(pool.onassetAmount);
  let borrowedOnUsd = toNumber(position.borrowedOnusd);
  let borrowedOnAsset = toNumber(position.borrowedOnasset);

  let claimableRatio =
    toNumber(position.liquidityTokenValue) /
    toNumber(pool.liquidityTokenSupply);

  let claimableOnUsd = poolOnUsdAmount * claimableRatio;
  let claimableOnAsset = poolOnAssetAmount * claimableRatio;

  let ILD = 0;
  let isOnUsd = true;

  if (borrowedOnUsd > claimableOnUsd) {
    ILD += borrowedOnUsd - claimableOnUsd;
  }
  if (borrowedOnAsset > claimableOnAsset) {
    const onassetDebt = borrowedOnAsset - claimableOnAsset;

    const oracleMarked = toNumber(pool.assetInfo.price) * onassetDebt;
    ILD += oracleMarked;
    isOnUsd = false;
  }

  const ilCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const assetCoefficient = toNumber(
    tokenData.pools[position.poolIndex].assetInfo.positionHealthScoreCoefficient
  );
  let totalLoss = ilCoefficient * ILD + assetCoefficient * borrowedOnUsd;
  const healthScore =
    100 - totalLoss / toNumber(comet.collaterals[cometIndex].collateralAmount);

  return { healthScore: healthScore, ILD: ILD, ildInOnUsd: isOnUsd };
};

export const getSinglePoolILD = (
  cometIndex: number,
  tokenData: TokenData,
  comet: Comet
): { onAssetILD: number, onusdILD: number, poolIndex: number, oraclePrice: number } => {
  let position = comet.positions[cometIndex];
  let pool = tokenData.pools[position.poolIndex];
  let poolOnUsdAmount = toNumber(pool.onusdAmount);
  let poolOnAssetAmount = toNumber(pool.onassetAmount);
  let borrowedOnUsd = toNumber(position.borrowedOnusd);
  let borrowedOnAsset = toNumber(position.borrowedOnasset);

  let claimableRatio =
    toNumber(position.liquidityTokenValue) /
    toNumber(pool.liquidityTokenSupply);

  let claimableOnUsd = floorToDevnetScale(poolOnUsdAmount * claimableRatio);
  let claimableOnAsset = floorToDevnetScale(poolOnAssetAmount * claimableRatio);
  let onusdILD = Math.max(floorToDevnetScale(borrowedOnUsd - claimableOnUsd), 0);
  let onAssetILD = Math.max(floorToDevnetScale(borrowedOnAsset - claimableOnAsset), 0);
  let oraclePrice = toNumber(pool.assetInfo.price);

  return { onAssetILD, onusdILD, oraclePrice, poolIndex: position.poolIndex }
};

export const getILD = (
  tokenData: TokenData,
  comet: Comet,
  poolIndex?: number
): { onAssetILD: number, onusdILD: number, poolIndex: number, oraclePrice: number }[] => {
  let results: { onAssetILD: number, onusdILD: number, poolIndex: number, oraclePrice: number }[] = [];

  comet.positions.slice(0, Number(comet.numPositions)).forEach((position) => {
    if (poolIndex !== undefined && poolIndex !== Number(position.poolIndex)) {
      return;
    }

    let pool = tokenData.pools[position.poolIndex];
    let poolOnUsdAmount = toNumber(pool.onusdAmount);
    let poolOnAssetAmount = toNumber(pool.onassetAmount);

    let borrowedOnUsd = toNumber(position.borrowedOnusd);
    let borrowedOnAsset = toNumber(position.borrowedOnasset);

    let claimableRatio =
      toNumber(position.liquidityTokenValue) /
      toNumber(pool.liquidityTokenSupply);

    let claimableOnUsd = floorToDevnetScale(poolOnUsdAmount * claimableRatio);
    let claimableOnAsset = floorToDevnetScale(poolOnAssetAmount * claimableRatio);
    let onusdILD = Math.max(floorToDevnetScale(borrowedOnUsd - claimableOnUsd), 0);
    let onAssetILD = Math.max(floorToDevnetScale(borrowedOnAsset - claimableOnAsset), 0);
    let oraclePrice = toNumber(pool.assetInfo.price);

    results.push({ onAssetILD, onusdILD, oraclePrice, poolIndex: position.poolIndex });
  });

  return results;
};

export const calculateNewSinglePoolCometFromOnUsdBorrowed = (
  poolIndex: number,
  collateralProvided: number,
  onusdBorrowed: number,
  tokenData: TokenData
): {
  healthScore: number;
  lowerPrice: number;
  upperPrice: number;
  maxOnUsdPosition: number;
} => {
  const pool = tokenData.pools[poolIndex];

  const poolOnUsd = toNumber(pool.onusdAmount);
  const poolOnAsset = toNumber(pool.onassetAmount);
  const poolPrice = poolOnUsd / poolOnAsset;

  const onassetBorrowed = onusdBorrowed / poolPrice;

  const claimableRatio = onusdBorrowed / (onusdBorrowed + poolOnUsd);

  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const loss = poolCoefficient * onusdBorrowed;

  const healthScore = 100 - loss / collateralProvided;

  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const maxILD = (100 * collateralProvided - loss) / ilHealthScoreCoefficient;

  const invariant = (poolOnUsd + onusdBorrowed) * (poolOnAsset + onassetBorrowed);

  // Solution 1: Price goes down, IL is in OnUSD
  let y1 = Math.max((onusdBorrowed - maxILD) / claimableRatio, 0);
  const lowerPrice = (y1 * y1) / invariant;

  // Solution 2: Price goes up, IL is in onAsset
  let a = onusdBorrowed / poolPrice / invariant;
  let b = -claimableRatio;
  let c = -maxILD;
  let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const upperPrice = (y2 * y2) / invariant;

  let maxOnUsdPosition = (100 * collateralProvided) / poolCoefficient;

  return {
    healthScore: healthScore,
    lowerPrice: lowerPrice,
    upperPrice: upperPrice,
    maxOnUsdPosition: maxOnUsdPosition,
  };
};

export const calculateNewSinglePoolCometFromRange = (
  poolIndex: number,
  collateralProvided: number,
  price: number,
  isLowerPrice: boolean,
  tokenData: TokenData
): {
  healthScore: number;
  lowerPrice: number;
  upperPrice: number;
  onusdBorrowed: number;
  maxOnUsdPosition: number;
} => {
  const pool = tokenData.pools[poolIndex];

  const poolOnUsd = toNumber(pool.onusdAmount);
  const poolOnAsset = toNumber(pool.onassetAmount);
  const poolPrice = poolOnUsd / poolOnAsset;

  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  let maxOnUsdPosition = (100 * collateralProvided) / poolCoefficient;

  const priceRange = (onusdBorrowed: number): number => {
    const claimableRatio = onusdBorrowed / (onusdBorrowed + poolOnUsd);

    const loss = poolCoefficient * onusdBorrowed;

    const maxILD = (100 * collateralProvided - loss) / ilHealthScoreCoefficient;

    const onassetBorrowed = onusdBorrowed / poolPrice;

    const invariant = (poolOnUsd + onusdBorrowed) * (poolOnAsset + onassetBorrowed);

    // Solution 1: Price goes down, IL is in OnUSD
    let y1 = Math.max((onusdBorrowed - maxILD) / claimableRatio, 0);
    const lowerPrice = (y1 * y1) / invariant;
    // Solution 2: Price goes up, IL is in onAsset
    let a = onusdBorrowed / poolPrice / invariant;
    let b = -claimableRatio;
    let c = -maxILD;
    let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const upperPrice = (y2 * y2) / invariant;

    return isLowerPrice ? lowerPrice : upperPrice;
  };

  let maxIter = 1000;
  let tolerance = 1e-9;
  let startSearch = 0;
  let stopSearch = maxOnUsdPosition;
  let positionGuess = (startSearch + stopSearch) * 0.5;
  let iter = 0;
  while (iter < maxIter) {
    positionGuess = (startSearch + stopSearch) * 0.5;

    let estPrice = priceRange(positionGuess);

    if (isLowerPrice) {
      let diff = estPrice - price;
      if (Math.abs(diff) < tolerance) {
        break;
      }

      if (diff < 0) {
        // Increase position to increase lower
        startSearch = positionGuess;
      } else {
        stopSearch = positionGuess;
      }
    } else {
      let diff = estPrice - price;
      if (Math.abs(diff) < tolerance) {
        break;
      }

      if (diff < 0) {
        // Reduce position to increase upper
        stopSearch = positionGuess;
      } else {
        startSearch = positionGuess;
      }
    }
    iter += 1;
  }

  if (iter === maxIter) {
    throw new CalculationError("Max iterations reached!");
  }

  const results = calculateNewSinglePoolCometFromOnUsdBorrowed(
    poolIndex,
    collateralProvided,
    positionGuess,
    tokenData
  );

  return { ...results, onusdBorrowed: positionGuess };
};

export const calculateEditCometSinglePoolWithOnUsdBorrowed = (
  tokenData: TokenData,
  comet: Comet,
  cometIndex: number,
  collateralChange: number,
  onusdBorrowedChange: number
): {
  maxCollateralWithdrawable: number;
  maxOnUsdPosition: number;
  healthScore: number;
  lowerPrice: number;
  upperPrice: number;
} => {
  const position = comet.positions[cometIndex];
  const pool = tokenData.pools[position.poolIndex];

  let lpTokens = toNumber(position.liquidityTokenValue);
  let positionBorrowedOnUsd = toNumber(position.borrowedOnusd);
  let positionBorrowedOnAsset = toNumber(position.borrowedOnasset);
  const poolOnUsd = toNumber(pool.onusdAmount);
  const poolOnAsset = toNumber(pool.onassetAmount);
  const poolLpTokens = toNumber(pool.liquidityTokenSupply);
  const claimableRatio = lpTokens / poolLpTokens;

  const poolPrice = poolOnUsd / poolOnAsset;
  const onassetBorrowedChange = onusdBorrowedChange / poolPrice;
  const initPrice = positionBorrowedOnUsd / positionBorrowedOnAsset;

  const newPoolOnUsd = poolOnUsd + onusdBorrowedChange;
  const newPoolonAsset = poolOnAsset + onassetBorrowedChange;

  let markPrice = toNumber(pool.assetInfo.price);
  let newClaimableRatio = claimableRatio;
  // Calculate total lp tokens
  const claimableOnUsd = claimableRatio * poolOnUsd;
  const newLpTokens =
    (lpTokens * (positionBorrowedOnUsd + onusdBorrowedChange)) / claimableOnUsd;
  newClaimableRatio = newLpTokens / (poolLpTokens - lpTokens + newLpTokens);
  let newPositionBorrowedOnUsd = positionBorrowedOnUsd + onusdBorrowedChange;
  let newPositionBorrowedOnAsset = positionBorrowedOnAsset + onassetBorrowedChange;

  const currentCollateral = toNumber(
    comet.collaterals[cometIndex].collateralAmount
  );
  let newCollateralAmount = currentCollateral + collateralChange;

  let claimableOnAsset = poolOnAsset * claimableRatio;
  let ILD = 0; // ILD doesnt change.
  let isOnUsd = false;
  if (initPrice < poolPrice) {
    ILD += (positionBorrowedOnAsset - claimableOnAsset) * markPrice;
  } else if (poolPrice < initPrice) {
    ILD += positionBorrowedOnUsd - claimableOnUsd;
    isOnUsd = true;
  }

  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const newPositionLoss = poolCoefficient * newPositionBorrowedOnUsd;
  const ildLoss = ilHealthScoreCoefficient * ILD;
  const loss = ildLoss + newPositionLoss;

  const newHealthScore = 100 - loss / newCollateralAmount;
  const maxCollateralWithdrawable = currentCollateral - loss / 100;

  const maxILD =
    (100 * newCollateralAmount - newPositionLoss) / ilHealthScoreCoefficient;

  const newInvariant = newPoolOnUsd * newPoolonAsset;

  // Solution 1: Price goes down, IL is in OnUSD
  let y1 = Math.max((newPositionBorrowedOnUsd - maxILD) / newClaimableRatio, 0);
  const lowerPrice = (y1 * y1) / newInvariant;

  // Solution 2: Price goes up, IL is in onAsset
  let a = newPositionBorrowedOnAsset / newInvariant;
  let b = -newClaimableRatio;
  let c = -maxILD;
  let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const upperPrice = (y2 * y2) / newInvariant;

  // Max OnUSD borrowed position possible before health = 0
  let maxOnUsdPosition = Math.max(
    0,
    (100 * newCollateralAmount - ildLoss) / poolCoefficient
  );

  return {
    maxCollateralWithdrawable: maxCollateralWithdrawable,
    healthScore: newHealthScore,
    maxOnUsdPosition: maxOnUsdPosition,
    lowerPrice: lowerPrice,
    upperPrice: upperPrice,
  };
};

export const calculateEditCometSinglePoolWithRange = (
  cometIndex: number,
  collateralChange: number,
  price: number,
  isLowerPrice: boolean,
  comet: Comet,
  tokenData: TokenData
): {
  maxCollateralWithdrawable: number;
  onusdPosition: number;
  healthScore: number;
  lowerPrice: number;
  upperPrice: number;
} => {
  const tolerance = 1e-9;
  const maxIter = 100000;
  const position = comet.positions[cometIndex];
  const currentOnUsdPosition = toNumber(position.borrowedOnusd);
  const currentOnAssetPosition = toNumber(position.borrowedOnasset);
  const pool = tokenData.pools[position.poolIndex];
  const poolOnUsd = toNumber(pool.onusdAmount);
  const poolOnAsset = toNumber(pool.onassetAmount);
  const poolPrice = poolOnUsd / poolOnAsset;
  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const poolLpTokens = toNumber(pool.liquidityTokenSupply);
  const lpTokens = toNumber(position.liquidityTokenValue);
  const claimableRatio = lpTokens / poolLpTokens;

  const currentCollateral = toNumber(
    comet.collaterals[cometIndex].collateralAmount
  );
  let newCollateralAmount = currentCollateral + collateralChange;

  const initData = calculateEditCometSinglePoolWithOnUsdBorrowed(
    tokenData,
    comet,
    cometIndex,
    collateralChange,
    0
  );

  const priceRange = (
    usdPosition: number
  ): { lower: number; upper: number } => {
    const onusdBorrowedChange = usdPosition - currentOnUsdPosition;
    let positionBorrowedOnUsd = currentOnUsdPosition;
    let positionBorrowedOnAsset = currentOnAssetPosition;
    const onassetBorrowedChange = onusdBorrowedChange / poolPrice;

    let newClaimableRatio = claimableRatio;
    // Calculate total lp tokens
    if (onusdBorrowedChange > 0) {
      newClaimableRatio += onusdBorrowedChange / (onusdBorrowedChange + poolOnUsd);
    } else if (onusdBorrowedChange < 0) {
      const claimableOnUsd = claimableRatio * poolOnUsd;
      const newLpTokens =
        (lpTokens * (positionBorrowedOnUsd + onusdBorrowedChange)) /
        claimableOnUsd;
      newClaimableRatio = newLpTokens / (poolLpTokens - lpTokens + newLpTokens);
    }
    positionBorrowedOnUsd += onusdBorrowedChange;
    positionBorrowedOnAsset += onassetBorrowedChange;

    let newPoolOnUsd = poolOnUsd + onusdBorrowedChange;
    let newPoolonAsset = poolOnAsset + onassetBorrowedChange;

    const positionLoss = poolCoefficient * positionBorrowedOnUsd;

    const maxILD =
      (100 * newCollateralAmount - positionLoss) / ilHealthScoreCoefficient;

    const newInvariant = newPoolOnUsd * newPoolonAsset;

    // Solution 1: Price goes down, IL is in OnUSD
    let y1 = Math.max((positionBorrowedOnUsd - maxILD) / newClaimableRatio, 0);
    const lowerPrice = (y1 * y1) / newInvariant;

    // Solution 2: Price goes up, IL is in onAsset
    let a = positionBorrowedOnAsset / newInvariant;
    let b = -newClaimableRatio;
    let c = -maxILD;
    let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const upperPrice = (y2 * y2) / newInvariant;

    // Max OnUSD borrowed position possible before health = 0
    a = ilHealthScoreCoefficient + poolCoefficient;
    b = poolCoefficient * newPoolOnUsd - 100 * newCollateralAmount;
    c = -100 * newCollateralAmount * newPoolOnUsd;

    return { lower: lowerPrice, upper: upperPrice };
  };

  let startSearch = 0;
  let stopSearch = initData.maxOnUsdPosition;
  let positionGuess = (startSearch + stopSearch) * 0.5;
  let iter = 0;
  while (iter < maxIter) {
    positionGuess = (startSearch + stopSearch) * 0.5;

    let range = priceRange(positionGuess);

    if (isLowerPrice) {
      let diff = range.lower - price;
      if (Math.abs(diff) < tolerance) {
        break;
      }

      if (diff < 0) {
        // Increase position to increase lower
        startSearch = positionGuess;
      } else {
        stopSearch = positionGuess;
      }
    } else {
      let diff = range.upper - price;
      if (Math.abs(diff) < tolerance) {
        break;
      }

      if (diff < 0) {
        // Reduce position to increase upper
        stopSearch = positionGuess;
      } else {
        startSearch = positionGuess;
      }
    }
    iter += 1;
  }

  if (iter === maxIter) {
    throw new CalculationError("Max iterations reached!");
  }

  const finalData = calculateEditCometSinglePoolWithOnUsdBorrowed(
    tokenData,
    comet,
    cometIndex,
    collateralChange,
    positionGuess - currentOnUsdPosition
  );
  return {
    maxCollateralWithdrawable: finalData.maxCollateralWithdrawable,
    onusdPosition: positionGuess,
    healthScore: finalData.healthScore,
    lowerPrice: isLowerPrice ? price : finalData.lowerPrice,
    upperPrice: !isLowerPrice ? price : finalData.upperPrice,
  };
};

export const calculateCometRecenterSinglePool = (
  cometIndex: number,
  tokenData: TokenData,
  comet: Comet
): {
  healthScore: number;
  onusdCost: number;
  lowerPrice: number;
  upperPrice: number;
} => {
  const position = comet.positions[cometIndex];
  const pool = tokenData.pools[position.poolIndex];

  const ilCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const assetCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const borrowedOnUsd = toNumber(position.borrowedOnusd);
  const borrowedOnAsset = toNumber(position.borrowedOnasset);
  const lpTokens = toNumber(position.liquidityTokenValue);

  const initPrice = borrowedOnUsd / borrowedOnAsset;
  let poolOnUsdAmount = toNumber(pool.onusdAmount);
  let poolOnAssetAmount = toNumber(pool.onassetAmount);
  let poolPrice = poolOnUsdAmount / poolOnAssetAmount;
  const invariant = poolOnUsdAmount * poolOnAssetAmount;

  const claimableRatio = lpTokens / toNumber(pool.liquidityTokenSupply);
  const invClaimableRatio = 1 - claimableRatio;

  if (Math.abs(initPrice - poolPrice) < 1e-8) {
    const prevHealthScore = getSinglePoolHealthScore(
      cometIndex,
      tokenData,
      comet
    );
    const estData = calculateEditCometSinglePoolWithOnUsdBorrowed(
      tokenData,
      comet,
      cometIndex,
      0,
      0
    );
    return {
      onusdCost: 0,
      healthScore: prevHealthScore.healthScore,
      lowerPrice: estData.lowerPrice,
      upperPrice: estData.upperPrice,
    };
  }
  const onAssetDiff = Math.abs(
    borrowedOnAsset - claimableRatio * poolOnAssetAmount
  );
  let onusdCost;
  if (initPrice < poolPrice) {
    const onAssetDebt = onAssetDiff / invClaimableRatio;
    // calculate extra onusd comet can claim, onasset debt that comet cannot claim, and onusd amount needed to buy onasset and cover debt
    const newPoolonAssetAmount = poolOnAssetAmount - onAssetDebt;
    const newPoolOnUsdAmount = invariant / newPoolonAssetAmount;
    const requiredOnUsd = invariant / newPoolonAssetAmount - poolOnUsdAmount;
    const onusdSurplus = claimableRatio * newPoolOnUsdAmount - borrowedOnUsd;
    onusdCost = requiredOnUsd - onusdSurplus;
    poolOnAssetAmount = newPoolonAssetAmount;
    poolOnUsdAmount = newPoolOnUsdAmount;
  } else {
    const onassetSurplus = onAssetDiff / invClaimableRatio;
    const newPoolonAssetAmount = poolOnAssetAmount + onassetSurplus;
    const newPoolOnUsdAmount = invariant / newPoolonAssetAmount;
    // calculate extra onAsset comet can claim, onusd debt that comet cannot claim, and amount of onusd gained from trading onasset.
    const onusdDebt = borrowedOnUsd - claimableRatio * newPoolOnUsdAmount;
    const onusdBurned = poolOnUsdAmount - newPoolOnUsdAmount;
    onusdCost = onusdDebt - onusdBurned;
    poolOnAssetAmount = newPoolonAssetAmount;
    poolOnUsdAmount = newPoolOnUsdAmount;
  }

  const newBorrowedOnUsd = claimableRatio * poolOnUsdAmount;
  const newBorrowedOnAsset = claimableRatio * poolOnAssetAmount;
  const prevCollateral = toNumber(
    comet.collaterals[cometIndex].collateralAmount
  );
  const newCollateral = prevCollateral - onusdCost;

  const positionLoss = assetCoefficient * newBorrowedOnUsd;

  const healthScore = 100 - positionLoss / newCollateral;

  const maxILD = (100 * newCollateral - positionLoss) / ilCoefficient;

  // Solution 1: Price goes down, IL is in OnUSD
  let y1 = Math.max((newBorrowedOnUsd - maxILD) / claimableRatio, 0);

  // Solution 2: Price goes up, IL is in onAsset
  let a = newBorrowedOnAsset / invariant;
  let b = -claimableRatio;
  let c = -maxILD;
  let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);

  return {
    onusdCost: onusdCost,
    healthScore: healthScore,
    lowerPrice: (y1 * y1) / invariant,
    upperPrice: (y2 * y2) / invariant,
  };
};

export const calculateCometRecenterMultiPool = (
  cometIndex: number,
  tokenData: TokenData,
  comet: Comet
): {
  healthScore: number;
  onusdCost: number;
} => {
  const position = comet.positions[cometIndex];
  const pool = tokenData.pools[position.poolIndex];

  const ilCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const assetCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const borrowedOnUsd = toNumber(position.borrowedOnusd);
  const borrowedOnAsset = toNumber(position.borrowedOnasset);
  const lpTokens = toNumber(position.liquidityTokenValue);
  const prevCollateral = getEffectiveUSDCollateralValue(tokenData, comet);

  const initPrice = borrowedOnUsd / borrowedOnAsset;
  let poolOnUsdAmount = toNumber(pool.onusdAmount);
  let poolOnAssetAmount = toNumber(pool.onassetAmount);
  let poolPrice = poolOnUsdAmount / poolOnAssetAmount;
  const invariant = poolOnUsdAmount * poolOnAssetAmount;

  const claimableRatio = lpTokens / toNumber(pool.liquidityTokenSupply);
  const invClaimableRatio = 1 - claimableRatio;

  const prevHealthScore = getHealthScore(tokenData, comet);

  if (Math.abs(initPrice - poolPrice) < 1e-8) {
    return {
      onusdCost: 0,
      healthScore: prevHealthScore.healthScore,
    };
  }

  const onAssetDiff = Math.abs(
    borrowedOnAsset - claimableRatio * poolOnAssetAmount
  );
  const onusdDiff = Math.abs(borrowedOnUsd - claimableRatio * poolOnUsdAmount);
  let onusdCost;
  let ildLoss;
  if (initPrice < poolPrice) {
    const onAssetDebt =
      (borrowedOnAsset - claimableRatio * poolOnAssetAmount) / invClaimableRatio;
    // calculate extra onusd comet can claim, onasset debt that comet cannot claim, and onusd amount needed to buy onasset and cover debt
    const newPoolonAssetAmount = poolOnAssetAmount - onAssetDebt;
    const newPoolOnUsdAmount = invariant / newPoolonAssetAmount;
    const requiredOnUsd = invariant / newPoolonAssetAmount - poolOnUsdAmount;
    const onusdSurplus = claimableRatio * newPoolOnUsdAmount - borrowedOnUsd;
    onusdCost = requiredOnUsd - onusdSurplus;
    ildLoss = onusdDiff * ilCoefficient;
    poolOnAssetAmount = newPoolonAssetAmount;
    poolOnUsdAmount = newPoolOnUsdAmount;
  } else {
    const onassetSurplus =
      (claimableRatio * poolOnAssetAmount - borrowedOnAsset) / invClaimableRatio;
    const newPoolonAssetAmount = poolOnAssetAmount + onassetSurplus;
    const newPoolOnUsdAmount = invariant / newPoolonAssetAmount;
    // calculate extra onAsset comet can claim, onusd debt that comet cannot claim, and amount of onusd gained from trading onasset.
    const onusdDebt = borrowedOnUsd - claimableRatio * newPoolOnUsdAmount;
    const onusdBurned = poolOnUsdAmount - newPoolOnUsdAmount;
    onusdCost = onusdDebt - onusdBurned;
    poolOnAssetAmount = newPoolonAssetAmount;
    poolOnUsdAmount = newPoolOnUsdAmount;
    const markPrice = toNumber(pool.assetInfo.price)
    ildLoss = onAssetDiff * markPrice * ilCoefficient;
  }

  const newBorrowedOnUsd = claimableRatio * poolOnUsdAmount;

  const newCollateral = prevCollateral - onusdCost;
  const prevLoss = (100 - prevHealthScore.healthScore) * prevCollateral;
  const newLoss =
    prevLoss - ildLoss - (borrowedOnUsd - newBorrowedOnUsd) * assetCoefficient;
  const healthScore = 100 - newLoss / newCollateral;

  return {
    onusdCost: onusdCost,
    healthScore: healthScore,
  };
};

export const getOnUSDAndonAssetAmountsFromLiquidtyTokens = (
  cometIndex: number,
  comet: Comet,
  tokenData: TokenData
): { onusdClaim: number; onAssetClaim: number } => {
  let position = comet.positions[cometIndex];
  let pool = tokenData.pools[position.poolIndex];

  let lpTokensClaimed = toNumber(position.liquidityTokenValue);
  let totalLpTokens = toNumber(pool.liquidityTokenSupply);

  let claimableRatio = lpTokensClaimed / totalLpTokens;

  return {
    onusdClaim: claimableRatio * toNumber(pool.onusdAmount),
    onAssetClaim: claimableRatio * toNumber(pool.onassetAmount),
  };
};
