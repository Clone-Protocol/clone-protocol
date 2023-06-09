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
        let poolOnusdAmount = toNumber(pool.onusdAmount);
        let poolOnassetAmount = toNumber(pool.onassetAmount);
        let borrowedOnusd = toNumber(position.borrowedOnusd);
        let borrowedOnasset = toNumber(position.borrowedOnasset);

        let claimableRatio =
          toNumber(position.liquidityTokenValue) /
          toNumber(pool.liquidityTokenSupply);

        let claimableOnusd = poolOnusdAmount * claimableRatio;
        let claimableOnasset = poolOnassetAmount * claimableRatio;

        let ilHealthScoreCoefficient = toNumber(
          pool.assetInfo.ilHealthScoreCoefficient
        );
        let poolHealthScoreCoefficient = toNumber(
          pool.assetInfo.positionHealthScoreCoefficient
        );

        let ild = 0;
        if (borrowedOnusd > claimableOnusd) {
          ild += borrowedOnusd - claimableOnusd;
        }
        if (borrowedOnasset > claimableOnasset) {
          const onassetDebt = borrowedOnasset - claimableOnasset;
          const oracleMarked = toNumber(pool.assetInfo.price) * onassetDebt;
          ild += oracleMarked;
        }

        let ilHealthImpact = ild * ilHealthScoreCoefficient;
        let positionHealthImpact = poolHealthScoreCoefficient * borrowedOnusd;

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
): { healthScore: number; ILD: number; ildInOnusd: boolean } => {
  let position = comet.positions[cometIndex];
  let pool = tokenData.pools[position.poolIndex];
  let poolOnusdAmount = toNumber(pool.onusdAmount);
  let poolOnassetAmount = toNumber(pool.onassetAmount);
  let borrowedOnusd = toNumber(position.borrowedOnusd);
  let borrowedOnasset = toNumber(position.borrowedOnasset);

  let claimableRatio =
    toNumber(position.liquidityTokenValue) /
    toNumber(pool.liquidityTokenSupply);

  let claimableOnusd = poolOnusdAmount * claimableRatio;
  let claimableOnasset = poolOnassetAmount * claimableRatio;

  let ILD = 0;
  let isOnusd = true;

  if (borrowedOnusd > claimableOnusd) {
    ILD += borrowedOnusd - claimableOnusd;
  }
  if (borrowedOnasset > claimableOnasset) {
    const onassetDebt = borrowedOnasset - claimableOnasset;

    const oracleMarked = toNumber(pool.assetInfo.price) * onassetDebt;
    ILD += oracleMarked;
    isOnusd = false;
  }

  const ilCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const assetCoefficient = toNumber(
    tokenData.pools[position.poolIndex].assetInfo.positionHealthScoreCoefficient
  );
  let totalLoss = ilCoefficient * ILD + assetCoefficient * borrowedOnusd;
  const healthScore =
    100 - totalLoss / toNumber(comet.collaterals[cometIndex].collateralAmount);

  return { healthScore: healthScore, ILD: ILD, ildInOnusd: isOnusd };
};

export const getSinglePoolILD = (
  cometIndex: number,
  tokenData: TokenData,
  comet: Comet
): { onAssetILD: number, onusdILD: number, poolIndex: number, oraclePrice: number } => {
  let position = comet.positions[cometIndex];
  let pool = tokenData.pools[position.poolIndex];
  let poolOnusdAmount = toNumber(pool.onusdAmount);
  let poolOnassetAmount = toNumber(pool.onassetAmount);
  let borrowedOnusd = toNumber(position.borrowedOnusd);
  let borrowedOnasset = toNumber(position.borrowedOnasset);

  let claimableRatio =
    toNumber(position.liquidityTokenValue) /
    toNumber(pool.liquidityTokenSupply);

  let claimableOnusd = floorToDevnetScale(poolOnusdAmount * claimableRatio);
  let claimableOnasset = floorToDevnetScale(poolOnassetAmount * claimableRatio);
  let onusdILD = Math.max(floorToDevnetScale(borrowedOnusd - claimableOnusd), 0);
  let onAssetILD = Math.max(floorToDevnetScale(borrowedOnasset - claimableOnasset), 0);
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
    let poolOnusdAmount = toNumber(pool.onusdAmount);
    let poolOnassetAmount = toNumber(pool.onassetAmount);

    let borrowedOnusd = toNumber(position.borrowedOnusd);
    let borrowedOnasset = toNumber(position.borrowedOnasset);

    let claimableRatio =
      toNumber(position.liquidityTokenValue) /
      toNumber(pool.liquidityTokenSupply);

    let claimableOnusd = floorToDevnetScale(poolOnusdAmount * claimableRatio);
    let claimableOnasset = floorToDevnetScale(poolOnassetAmount * claimableRatio);
    let onusdILD = Math.max(floorToDevnetScale(borrowedOnusd - claimableOnusd), 0);
    let onAssetILD = Math.max(floorToDevnetScale(borrowedOnasset - claimableOnasset), 0);
    let oraclePrice = toNumber(pool.assetInfo.price);

    results.push({ onAssetILD, onusdILD, oraclePrice, poolIndex: position.poolIndex });
  });

  return results;
};

export const calculateNewSinglePoolCometFromOnusdBorrowed = (
  poolIndex: number,
  collateralProvided: number,
  onusdBorrowed: number,
  tokenData: TokenData
): {
  healthScore: number;
  lowerPrice: number;
  upperPrice: number;
  maxOnusdPosition: number;
} => {
  const pool = tokenData.pools[poolIndex];

  const poolOnusd = toNumber(pool.onusdAmount);
  const poolOnasset = toNumber(pool.onassetAmount);
  const poolPrice = poolOnusd / poolOnasset;

  const onassetBorrowed = onusdBorrowed / poolPrice;

  const claimableRatio = onusdBorrowed / (onusdBorrowed + poolOnusd);

  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const loss = poolCoefficient * onusdBorrowed;

  const healthScore = 100 - loss / collateralProvided;

  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const maxILD = (100 * collateralProvided - loss) / ilHealthScoreCoefficient;

  const invariant = (poolOnusd + onusdBorrowed) * (poolOnasset + onassetBorrowed);

  // Solution 1: Price goes down, IL is in OnUSD
  let y1 = Math.max((onusdBorrowed - maxILD) / claimableRatio, 0);
  const lowerPrice = (y1 * y1) / invariant;

  // Solution 2: Price goes up, IL is in onAsset
  let a = onusdBorrowed / poolPrice / invariant;
  let b = -claimableRatio;
  let c = -maxILD;
  let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const upperPrice = (y2 * y2) / invariant;

  let maxOnusdPosition = (100 * collateralProvided) / poolCoefficient;

  return {
    healthScore: healthScore,
    lowerPrice: lowerPrice,
    upperPrice: upperPrice,
    maxOnusdPosition: maxOnusdPosition,
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
  maxOnusdPosition: number;
} => {
  const pool = tokenData.pools[poolIndex];

  const poolOnusd = toNumber(pool.onusdAmount);
  const poolOnasset = toNumber(pool.onassetAmount);
  const poolPrice = poolOnusd / poolOnasset;

  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  let maxOnusdPosition = (100 * collateralProvided) / poolCoefficient;

  const priceRange = (onusdBorrowed: number): number => {
    const claimableRatio = onusdBorrowed / (onusdBorrowed + poolOnusd);

    const loss = poolCoefficient * onusdBorrowed;

    const maxILD = (100 * collateralProvided - loss) / ilHealthScoreCoefficient;

    const onassetBorrowed = onusdBorrowed / poolPrice;

    const invariant = (poolOnusd + onusdBorrowed) * (poolOnasset + onassetBorrowed);

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
  let stopSearch = maxOnusdPosition;
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

  const results = calculateNewSinglePoolCometFromOnusdBorrowed(
    poolIndex,
    collateralProvided,
    positionGuess,
    tokenData
  );

  return { ...results, onusdBorrowed: positionGuess };
};

export const calculateEditCometSinglePoolWithOnusdBorrowed = (
  tokenData: TokenData,
  comet: Comet,
  cometIndex: number,
  collateralChange: number,
  onusdBorrowedChange: number
): {
  maxCollateralWithdrawable: number;
  maxOnusdPosition: number;
  healthScore: number;
  lowerPrice: number;
  upperPrice: number;
} => {
  const position = comet.positions[cometIndex];
  const pool = tokenData.pools[position.poolIndex];

  let lpTokens = toNumber(position.liquidityTokenValue);
  let positionBorrowedOnusd = toNumber(position.borrowedOnusd);
  let positionBorrowedOnasset = toNumber(position.borrowedOnasset);
  const poolOnusd = toNumber(pool.onusdAmount);
  const poolOnasset = toNumber(pool.onassetAmount);
  const poolLpTokens = toNumber(pool.liquidityTokenSupply);
  const claimableRatio = lpTokens / poolLpTokens;

  const poolPrice = poolOnusd / poolOnasset;
  const onassetBorrowedChange = onusdBorrowedChange / poolPrice;
  const initPrice = positionBorrowedOnusd / positionBorrowedOnasset;

  const newPoolOnusd = poolOnusd + onusdBorrowedChange;
  const newPoolonAsset = poolOnasset + onassetBorrowedChange;

  let markPrice = toNumber(pool.assetInfo.price);
  let newClaimableRatio = claimableRatio;
  // Calculate total lp tokens
  const claimableOnusd = claimableRatio * poolOnusd;
  const newLpTokens =
    (lpTokens * (positionBorrowedOnusd + onusdBorrowedChange)) / claimableOnusd;
  newClaimableRatio = newLpTokens / (poolLpTokens - lpTokens + newLpTokens);
  let newPositionBorrowedOnusd = positionBorrowedOnusd + onusdBorrowedChange;
  let newPositionBorrowedOnasset = positionBorrowedOnasset + onassetBorrowedChange;

  const currentCollateral = toNumber(
    comet.collaterals[cometIndex].collateralAmount
  );
  let newCollateralAmount = currentCollateral + collateralChange;

  let claimableOnasset = poolOnasset * claimableRatio;
  let ILD = 0; // ILD doesnt change.
  let isOnusd = false;
  if (initPrice < poolPrice) {
    ILD += (positionBorrowedOnasset - claimableOnasset) * markPrice;
  } else if (poolPrice < initPrice) {
    ILD += positionBorrowedOnusd - claimableOnusd;
    isOnusd = true;
  }

  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const newPositionLoss = poolCoefficient * newPositionBorrowedOnusd;
  const ildLoss = ilHealthScoreCoefficient * ILD;
  const loss = ildLoss + newPositionLoss;

  const newHealthScore = 100 - loss / newCollateralAmount;
  const maxCollateralWithdrawable = currentCollateral - loss / 100;

  const maxILD =
    (100 * newCollateralAmount - newPositionLoss) / ilHealthScoreCoefficient;

  const newInvariant = newPoolOnusd * newPoolonAsset;

  // Solution 1: Price goes down, IL is in OnUSD
  let y1 = Math.max((newPositionBorrowedOnusd - maxILD) / newClaimableRatio, 0);
  const lowerPrice = (y1 * y1) / newInvariant;

  // Solution 2: Price goes up, IL is in onAsset
  let a = newPositionBorrowedOnasset / newInvariant;
  let b = -newClaimableRatio;
  let c = -maxILD;
  let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const upperPrice = (y2 * y2) / newInvariant;

  // Max OnUSD borrowed position possible before health = 0
  let maxOnusdPosition = Math.max(
    0,
    (100 * newCollateralAmount - ildLoss) / poolCoefficient
  );

  return {
    maxCollateralWithdrawable: maxCollateralWithdrawable,
    healthScore: newHealthScore,
    maxOnusdPosition: maxOnusdPosition,
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
  const currentOnusdPosition = toNumber(position.borrowedOnusd);
  const currentOnassetPosition = toNumber(position.borrowedOnasset);
  const pool = tokenData.pools[position.poolIndex];
  const poolOnusd = toNumber(pool.onusdAmount);
  const poolOnasset = toNumber(pool.onassetAmount);
  const poolPrice = poolOnusd / poolOnasset;
  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const poolLpTokens = toNumber(pool.liquidityTokenSupply);
  const lpTokens = toNumber(position.liquidityTokenValue);
  const claimableRatio = lpTokens / poolLpTokens;

  const currentCollateral = toNumber(
    comet.collaterals[cometIndex].collateralAmount
  );
  let newCollateralAmount = currentCollateral + collateralChange;

  const initData = calculateEditCometSinglePoolWithOnusdBorrowed(
    tokenData,
    comet,
    cometIndex,
    collateralChange,
    0
  );

  const priceRange = (
    usdPosition: number
  ): { lower: number; upper: number } => {
    const onusdBorrowedChange = usdPosition - currentOnusdPosition;
    let positionBorrowedOnusd = currentOnusdPosition;
    let positionBorrowedOnasset = currentOnassetPosition;
    const onassetBorrowedChange = onusdBorrowedChange / poolPrice;

    let newClaimableRatio = claimableRatio;
    // Calculate total lp tokens
    if (onusdBorrowedChange > 0) {
      newClaimableRatio += onusdBorrowedChange / (onusdBorrowedChange + poolOnusd);
    } else if (onusdBorrowedChange < 0) {
      const claimableOnusd = claimableRatio * poolOnusd;
      const newLpTokens =
        (lpTokens * (positionBorrowedOnusd + onusdBorrowedChange)) /
        claimableOnusd;
      newClaimableRatio = newLpTokens / (poolLpTokens - lpTokens + newLpTokens);
    }
    positionBorrowedOnusd += onusdBorrowedChange;
    positionBorrowedOnasset += onassetBorrowedChange;

    let newPoolOnusd = poolOnusd + onusdBorrowedChange;
    let newPoolonAsset = poolOnasset + onassetBorrowedChange;

    const positionLoss = poolCoefficient * positionBorrowedOnusd;

    const maxILD =
      (100 * newCollateralAmount - positionLoss) / ilHealthScoreCoefficient;

    const newInvariant = newPoolOnusd * newPoolonAsset;

    // Solution 1: Price goes down, IL is in OnUSD
    let y1 = Math.max((positionBorrowedOnusd - maxILD) / newClaimableRatio, 0);
    const lowerPrice = (y1 * y1) / newInvariant;

    // Solution 2: Price goes up, IL is in onAsset
    let a = positionBorrowedOnasset / newInvariant;
    let b = -newClaimableRatio;
    let c = -maxILD;
    let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const upperPrice = (y2 * y2) / newInvariant;

    // Max OnUSD borrowed position possible before health = 0
    a = ilHealthScoreCoefficient + poolCoefficient;
    b = poolCoefficient * newPoolOnusd - 100 * newCollateralAmount;
    c = -100 * newCollateralAmount * newPoolOnusd;

    return { lower: lowerPrice, upper: upperPrice };
  };

  let startSearch = 0;
  let stopSearch = initData.maxOnusdPosition;
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

  const finalData = calculateEditCometSinglePoolWithOnusdBorrowed(
    tokenData,
    comet,
    cometIndex,
    collateralChange,
    positionGuess - currentOnusdPosition
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

  const borrowedOnusd = toNumber(position.borrowedOnusd);
  const borrowedOnasset = toNumber(position.borrowedOnasset);
  const lpTokens = toNumber(position.liquidityTokenValue);

  const initPrice = borrowedOnusd / borrowedOnasset;
  let poolOnusdAmount = toNumber(pool.onusdAmount);
  let poolOnassetAmount = toNumber(pool.onassetAmount);
  let poolPrice = poolOnusdAmount / poolOnassetAmount;
  const invariant = poolOnusdAmount * poolOnassetAmount;

  const claimableRatio = lpTokens / toNumber(pool.liquidityTokenSupply);
  const invClaimableRatio = 1 - claimableRatio;

  if (Math.abs(initPrice - poolPrice) < 1e-8) {
    const prevHealthScore = getSinglePoolHealthScore(
      cometIndex,
      tokenData,
      comet
    );
    const estData = calculateEditCometSinglePoolWithOnusdBorrowed(
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
    borrowedOnasset - claimableRatio * poolOnassetAmount
  );
  let onusdCost;
  if (initPrice < poolPrice) {
    const onAssetDebt = onAssetDiff / invClaimableRatio;
    // calculate extra onusd comet can claim, onasset debt that comet cannot claim, and onusd amount needed to buy onasset and cover debt
    const newPoolonAssetAmount = poolOnassetAmount - onAssetDebt;
    const newPoolOnusdAmount = invariant / newPoolonAssetAmount;
    const requiredOnusd = invariant / newPoolonAssetAmount - poolOnusdAmount;
    const onusdSurplus = claimableRatio * newPoolOnusdAmount - borrowedOnusd;
    onusdCost = requiredOnusd - onusdSurplus;
    poolOnassetAmount = newPoolonAssetAmount;
    poolOnusdAmount = newPoolOnusdAmount;
  } else {
    const onassetSurplus = onAssetDiff / invClaimableRatio;
    const newPoolonAssetAmount = poolOnassetAmount + onassetSurplus;
    const newPoolOnusdAmount = invariant / newPoolonAssetAmount;
    // calculate extra onAsset comet can claim, onusd debt that comet cannot claim, and amount of onusd gained from trading onasset.
    const onusdDebt = borrowedOnusd - claimableRatio * newPoolOnusdAmount;
    const onusdBurned = poolOnusdAmount - newPoolOnusdAmount;
    onusdCost = onusdDebt - onusdBurned;
    poolOnassetAmount = newPoolonAssetAmount;
    poolOnusdAmount = newPoolOnusdAmount;
  }

  const newBorrowedOnusd = claimableRatio * poolOnusdAmount;
  const newBorrowedOnasset = claimableRatio * poolOnassetAmount;
  const prevCollateral = toNumber(
    comet.collaterals[cometIndex].collateralAmount
  );
  const newCollateral = prevCollateral - onusdCost;

  const positionLoss = assetCoefficient * newBorrowedOnusd;

  const healthScore = 100 - positionLoss / newCollateral;

  const maxILD = (100 * newCollateral - positionLoss) / ilCoefficient;

  // Solution 1: Price goes down, IL is in OnUSD
  let y1 = Math.max((newBorrowedOnusd - maxILD) / claimableRatio, 0);

  // Solution 2: Price goes up, IL is in onAsset
  let a = newBorrowedOnasset / invariant;
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

  const borrowedOnusd = toNumber(position.borrowedOnusd);
  const borrowedOnasset = toNumber(position.borrowedOnasset);
  const lpTokens = toNumber(position.liquidityTokenValue);
  const prevCollateral = getEffectiveUSDCollateralValue(tokenData, comet);

  const initPrice = borrowedOnusd / borrowedOnasset;
  let poolOnusdAmount = toNumber(pool.onusdAmount);
  let poolOnassetAmount = toNumber(pool.onassetAmount);
  let poolPrice = poolOnusdAmount / poolOnassetAmount;
  const invariant = poolOnusdAmount * poolOnassetAmount;

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
    borrowedOnasset - claimableRatio * poolOnassetAmount
  );
  const onusdDiff = Math.abs(borrowedOnusd - claimableRatio * poolOnusdAmount);
  let onusdCost;
  let ildLoss;
  if (initPrice < poolPrice) {
    const onAssetDebt =
      (borrowedOnasset - claimableRatio * poolOnassetAmount) / invClaimableRatio;
    // calculate extra onusd comet can claim, onasset debt that comet cannot claim, and onusd amount needed to buy onasset and cover debt
    const newPoolonAssetAmount = poolOnassetAmount - onAssetDebt;
    const newPoolOnusdAmount = invariant / newPoolonAssetAmount;
    const requiredOnusd = invariant / newPoolonAssetAmount - poolOnusdAmount;
    const onusdSurplus = claimableRatio * newPoolOnusdAmount - borrowedOnusd;
    onusdCost = requiredOnusd - onusdSurplus;
    ildLoss = onusdDiff * ilCoefficient;
    poolOnassetAmount = newPoolonAssetAmount;
    poolOnusdAmount = newPoolOnusdAmount;
  } else {
    const onassetSurplus =
      (claimableRatio * poolOnassetAmount - borrowedOnasset) / invClaimableRatio;
    const newPoolonAssetAmount = poolOnassetAmount + onassetSurplus;
    const newPoolOnusdAmount = invariant / newPoolonAssetAmount;
    // calculate extra onAsset comet can claim, onusd debt that comet cannot claim, and amount of onusd gained from trading onasset.
    const onusdDebt = borrowedOnusd - claimableRatio * newPoolOnusdAmount;
    const onusdBurned = poolOnusdAmount - newPoolOnusdAmount;
    onusdCost = onusdDebt - onusdBurned;
    poolOnassetAmount = newPoolonAssetAmount;
    poolOnusdAmount = newPoolOnusdAmount;
    const markPrice = toNumber(pool.assetInfo.price)
    ildLoss = onAssetDiff * markPrice * ilCoefficient;
  }

  const newBorrowedOnusd = claimableRatio * poolOnusdAmount;

  const newCollateral = prevCollateral - onusdCost;
  const prevLoss = (100 - prevHealthScore.healthScore) * prevCollateral;
  const newLoss =
    prevLoss - ildLoss - (borrowedOnusd - newBorrowedOnusd) * assetCoefficient;
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
