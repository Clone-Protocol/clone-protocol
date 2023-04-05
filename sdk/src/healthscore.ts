import { TokenData, Comet } from "./interfaces";
import { toNumber } from "./decimal";
import { CalculationError } from "./error";
import { floorToDevnetScale } from "./utils"

export const getEffectiveUSDCollateralValue = (
  tokenData: TokenData,
  comet: Comet
) => {
  // Iterate through collaterals.
  let effectiveUSDCollateral = 0;

  comet.collaterals
    .slice(0, comet.numCollaterals.toNumber())
    .forEach((cometCollateral) => {
      const collateral = tokenData.collaterals[cometCollateral.collateralIndex];
      if (collateral.stable.toNumber() === 1) {
        effectiveUSDCollateral += toNumber(cometCollateral.collateralAmount);
      } else {
        const pool = tokenData.pools[collateral.poolIndex.toNumber()];
        const oraclePrice = toNumber(pool.assetInfo.price);
        effectiveUSDCollateral +=
          (oraclePrice * toNumber(cometCollateral.collateralAmount)) /
          toNumber(pool.assetInfo.cryptoCollateralRatio);
      }
    });

  return effectiveUSDCollateral;
};

export const getHealthScore = (
  tokenData: TokenData,
  comet: Comet
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
        let poolUsdiAmount = toNumber(pool.usdiAmount);
        let poolIassetAmount = toNumber(pool.iassetAmount);
        let borrowedUsdi = toNumber(position.borrowedUsdi);
        let borrowedIasset = toNumber(position.borrowedIasset);

        let claimableRatio =
          toNumber(position.liquidityTokenValue) /
          toNumber(pool.liquidityTokenSupply);

        let claimableUsdi = poolUsdiAmount * claimableRatio;
        let claimableIasset = poolIassetAmount * claimableRatio;

        let ilHealthScoreCoefficient = toNumber(
          pool.assetInfo.ilHealthScoreCoefficient
        );
        let poolHealthScoreCoefficient = toNumber(
          pool.assetInfo.positionHealthScoreCoefficient
        );

        let ild = 0;
        if (borrowedUsdi > claimableUsdi) {
          ild += borrowedUsdi - claimableUsdi;
        }
        if (borrowedIasset > claimableIasset) {
          const iassetDebt = borrowedIasset - claimableIasset;
          const oracleMarked = toNumber(pool.assetInfo.price) * iassetDebt;
          ild += oracleMarked;
        }

        let ilHealthImpact = ild * ilHealthScoreCoefficient;
        let positionHealthImpact = poolHealthScoreCoefficient * borrowedUsdi;

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
): { healthScore: number; ILD: number; ildInUsdi: boolean } => {
  let position = comet.positions[cometIndex];
  let pool = tokenData.pools[position.poolIndex];
  let poolUsdiAmount = toNumber(pool.usdiAmount);
  let poolIassetAmount = toNumber(pool.iassetAmount);
  let borrowedUsdi = toNumber(position.borrowedUsdi);
  let borrowedIasset = toNumber(position.borrowedIasset);

  let claimableRatio =
    toNumber(position.liquidityTokenValue) /
    toNumber(pool.liquidityTokenSupply);

  let claimableUsdi = poolUsdiAmount * claimableRatio;
  let claimableIasset = poolIassetAmount * claimableRatio;

  let ILD = 0;
  let isUsdi = true;

  if (borrowedUsdi > claimableUsdi) {
    ILD += borrowedUsdi - claimableUsdi;
  }
  if (borrowedIasset > claimableIasset) {
    const iassetDebt = borrowedIasset - claimableIasset;

    const oracleMarked = toNumber(pool.assetInfo.price) * iassetDebt;
    ILD += oracleMarked;
    isUsdi = false;
  }

  const ilCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const assetCoefficient = toNumber(
    tokenData.pools[position.poolIndex].assetInfo.positionHealthScoreCoefficient
  );
  let totalLoss = ilCoefficient * ILD + assetCoefficient * borrowedUsdi;
  const healthScore =
    100 - totalLoss / toNumber(comet.collaterals[cometIndex].collateralAmount);

  return { healthScore: healthScore, ILD: ILD, ildInUsdi: isUsdi };
};

export const getSinglePoolILD = (
  cometIndex: number,
  tokenData: TokenData,
  comet: Comet
): { iAssetILD: number, usdiILD: number, poolIndex: number, oraclePrice: number } => {
  let position = comet.positions[cometIndex];
  let pool = tokenData.pools[position.poolIndex];
  let poolUsdiAmount = toNumber(pool.usdiAmount);
  let poolIassetAmount = toNumber(pool.iassetAmount);
  let borrowedUsdi = toNumber(position.borrowedUsdi);
  let borrowedIasset = toNumber(position.borrowedIasset);

  let claimableRatio =
    toNumber(position.liquidityTokenValue) /
    toNumber(pool.liquidityTokenSupply);

  let claimableUsdi = floorToDevnetScale(poolUsdiAmount * claimableRatio);
  let claimableIasset = floorToDevnetScale(poolIassetAmount * claimableRatio);
  let usdiILD = Math.max(floorToDevnetScale(borrowedUsdi - claimableUsdi), 0);
  let iAssetILD = Math.max(floorToDevnetScale(borrowedIasset - claimableIasset), 0);
  let oraclePrice = toNumber(pool.assetInfo.price);

  return { iAssetILD, usdiILD, oraclePrice, poolIndex: position.poolIndex }
};

export const getILD = (
  tokenData: TokenData,
  comet: Comet,
  poolIndex?: number
): { iAssetILD: number, usdiILD: number, poolIndex: number, oraclePrice: number }[] => {
  let results: { iAssetILD: number, usdiILD: number, poolIndex: number, oraclePrice: number }[] = [];

  comet.positions.slice(0, Number(comet.numPositions)).forEach((position) => {
    if (poolIndex !== undefined && poolIndex !== Number(position.poolIndex)) {
      return;
    }

    let pool = tokenData.pools[position.poolIndex];
    let poolUsdiAmount = toNumber(pool.usdiAmount);
    let poolIassetAmount = toNumber(pool.iassetAmount);

    let borrowedUsdi = toNumber(position.borrowedUsdi);
    let borrowedIasset = toNumber(position.borrowedIasset);

    let claimableRatio =
      toNumber(position.liquidityTokenValue) /
      toNumber(pool.liquidityTokenSupply);

    let claimableUsdi = floorToDevnetScale(poolUsdiAmount * claimableRatio);
    let claimableIasset = floorToDevnetScale(poolIassetAmount * claimableRatio);
    let usdiILD = Math.max(floorToDevnetScale(borrowedUsdi - claimableUsdi), 0);
    let iAssetILD = Math.max(floorToDevnetScale(borrowedIasset - claimableIasset), 0);
    let oraclePrice = toNumber(pool.assetInfo.price);

    results.push({ iAssetILD, usdiILD, oraclePrice, poolIndex: position.poolIndex });
  });

  return results;
};

export const calculateNewSinglePoolCometFromUsdiBorrowed = (
  poolIndex: number,
  collateralProvided: number,
  usdiBorrowed: number,
  tokenData: TokenData
): {
  healthScore: number;
  lowerPrice: number;
  upperPrice: number;
  maxUsdiPosition: number;
} => {
  const pool = tokenData.pools[poolIndex];

  const poolUsdi = toNumber(pool.usdiAmount);
  const poolIasset = toNumber(pool.iassetAmount);
  const poolPrice = poolUsdi / poolIasset;

  const iassetBorrowed = usdiBorrowed / poolPrice;

  const claimableRatio = usdiBorrowed / (usdiBorrowed + poolUsdi);

  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const loss = poolCoefficient * usdiBorrowed;

  const healthScore = 100 - loss / collateralProvided;

  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const maxILD = (100 * collateralProvided - loss) / ilHealthScoreCoefficient;

  const invariant = (poolUsdi + usdiBorrowed) * (poolIasset + iassetBorrowed);

  // Solution 1: Price goes down, IL is in USDi
  let y1 = Math.max((usdiBorrowed - maxILD) / claimableRatio, 0);
  const lowerPrice = (y1 * y1) / invariant;

  // Solution 2: Price goes up, IL is in iAsset
  let a = usdiBorrowed / poolPrice / invariant;
  let b = -claimableRatio;
  let c = -maxILD;
  let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const upperPrice = (y2 * y2) / invariant;

  let maxUsdiPosition = (100 * collateralProvided) / poolCoefficient;

  return {
    healthScore: healthScore,
    lowerPrice: lowerPrice,
    upperPrice: upperPrice,
    maxUsdiPosition: maxUsdiPosition,
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
  usdiBorrowed: number;
  maxUsdiPosition: number;
} => {
  const pool = tokenData.pools[poolIndex];

  const poolUsdi = toNumber(pool.usdiAmount);
  const poolIasset = toNumber(pool.iassetAmount);
  const poolPrice = poolUsdi / poolIasset;

  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  let maxUsdiPosition = (100 * collateralProvided) / poolCoefficient;

  const priceRange = (usdiBorrowed: number): number => {
    const claimableRatio = usdiBorrowed / (usdiBorrowed + poolUsdi);

    const loss = poolCoefficient * usdiBorrowed;

    const maxILD = (100 * collateralProvided - loss) / ilHealthScoreCoefficient;

    const iassetBorrowed = usdiBorrowed / poolPrice;

    const invariant = (poolUsdi + usdiBorrowed) * (poolIasset + iassetBorrowed);

    // Solution 1: Price goes down, IL is in USDi
    let y1 = Math.max((usdiBorrowed - maxILD) / claimableRatio, 0);
    const lowerPrice = (y1 * y1) / invariant;
    // Solution 2: Price goes up, IL is in iAsset
    let a = usdiBorrowed / poolPrice / invariant;
    let b = -claimableRatio;
    let c = -maxILD;
    let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const upperPrice = (y2 * y2) / invariant;

    return isLowerPrice ? lowerPrice : upperPrice;
  };

  let maxIter = 1000;
  let tolerance = 1e-9;
  let startSearch = 0;
  let stopSearch = maxUsdiPosition;
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

  const results = calculateNewSinglePoolCometFromUsdiBorrowed(
    poolIndex,
    collateralProvided,
    positionGuess,
    tokenData
  );

  return { ...results, usdiBorrowed: positionGuess };
};

export const calculateEditCometSinglePoolWithUsdiBorrowed = (
  tokenData: TokenData,
  comet: Comet,
  cometIndex: number,
  collateralChange: number,
  usdiBorrowedChange: number
): {
  maxCollateralWithdrawable: number;
  maxUsdiPosition: number;
  healthScore: number;
  lowerPrice: number;
  upperPrice: number;
} => {
  const position = comet.positions[cometIndex];
  const pool = tokenData.pools[position.poolIndex];

  let lpTokens = toNumber(position.liquidityTokenValue);
  let positionBorrowedUsdi = toNumber(position.borrowedUsdi);
  let positionBorrowedIasset = toNumber(position.borrowedIasset);
  const poolUsdi = toNumber(pool.usdiAmount);
  const poolIasset = toNumber(pool.iassetAmount);
  const poolLpTokens = toNumber(pool.liquidityTokenSupply);
  const claimableRatio = lpTokens / poolLpTokens;

  const poolPrice = poolUsdi / poolIasset;
  const iassetBorrowedChange = usdiBorrowedChange / poolPrice;
  const initPrice = positionBorrowedUsdi / positionBorrowedIasset;

  const newPoolUsdi = poolUsdi + usdiBorrowedChange;
  const newPooliAsset = poolIasset + iassetBorrowedChange;

  let markPrice = toNumber(pool.assetInfo.price);
  let newClaimableRatio = claimableRatio;
  // Calculate total lp tokens
  const claimableUsdi = claimableRatio * poolUsdi;
  const newLpTokens =
    (lpTokens * (positionBorrowedUsdi + usdiBorrowedChange)) / claimableUsdi;
  newClaimableRatio = newLpTokens / (poolLpTokens - lpTokens + newLpTokens);
  let newPositionBorrowedUsdi = positionBorrowedUsdi + usdiBorrowedChange;
  let newPositionBorrowedIasset = positionBorrowedIasset + iassetBorrowedChange;

  const currentCollateral = toNumber(
    comet.collaterals[cometIndex].collateralAmount
  );
  let newCollateralAmount = currentCollateral + collateralChange;

  let claimableIasset = poolIasset * claimableRatio;
  let ILD = 0; // ILD doesnt change.
  let isUsdi = false;
  if (initPrice < poolPrice) {
    ILD += (positionBorrowedIasset - claimableIasset) * markPrice;
  } else if (poolPrice < initPrice) {
    ILD += positionBorrowedUsdi - claimableUsdi;
    isUsdi = true;
  }

  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const newPositionLoss = poolCoefficient * newPositionBorrowedUsdi;
  const ildLoss = ilHealthScoreCoefficient * ILD;
  const loss = ildLoss + newPositionLoss;

  const newHealthScore = 100 - loss / newCollateralAmount;
  const maxCollateralWithdrawable = currentCollateral - loss / 100;

  const maxILD =
    (100 * newCollateralAmount - newPositionLoss) / ilHealthScoreCoefficient;

  const newInvariant = newPoolUsdi * newPooliAsset;

  // Solution 1: Price goes down, IL is in USDi
  let y1 = Math.max((newPositionBorrowedUsdi - maxILD) / newClaimableRatio, 0);
  const lowerPrice = (y1 * y1) / newInvariant;

  // Solution 2: Price goes up, IL is in iAsset
  let a = newPositionBorrowedIasset / newInvariant;
  let b = -newClaimableRatio;
  let c = -maxILD;
  let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const upperPrice = (y2 * y2) / newInvariant;

  // Max USDi borrowed position possible before health = 0
  let maxUsdiPosition = Math.max(
    0,
    (100 * newCollateralAmount - ildLoss) / poolCoefficient
  );

  return {
    maxCollateralWithdrawable: maxCollateralWithdrawable,
    healthScore: newHealthScore,
    maxUsdiPosition: maxUsdiPosition,
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
  usdiPosition: number;
  healthScore: number;
  lowerPrice: number;
  upperPrice: number;
} => {
  const tolerance = 1e-9;
  const maxIter = 100000;
  const position = comet.positions[cometIndex];
  const currentUsdiPosition = toNumber(position.borrowedUsdi);
  const currentIassetPosition = toNumber(position.borrowedIasset);
  const pool = tokenData.pools[position.poolIndex];
  const poolUsdi = toNumber(pool.usdiAmount);
  const poolIasset = toNumber(pool.iassetAmount);
  const poolPrice = poolUsdi / poolIasset;
  const ilHealthScoreCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const poolCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const poolLpTokens = toNumber(pool.liquidityTokenSupply);
  const lpTokens = toNumber(position.liquidityTokenValue);
  const claimableRatio = lpTokens / poolLpTokens;

  const currentCollateral = toNumber(
    comet.collaterals[cometIndex].collateralAmount
  );
  let newCollateralAmount = currentCollateral + collateralChange;

  const initData = calculateEditCometSinglePoolWithUsdiBorrowed(
    tokenData,
    comet,
    cometIndex,
    collateralChange,
    0
  );

  const priceRange = (
    usdPosition: number
  ): { lower: number; upper: number } => {
    const usdiBorrowedChange = usdPosition - currentUsdiPosition;
    let positionBorrowedUsdi = currentUsdiPosition;
    let positionBorrowedIasset = currentIassetPosition;
    const iassetBorrowedChange = usdiBorrowedChange / poolPrice;

    let newClaimableRatio = claimableRatio;
    // Calculate total lp tokens
    if (usdiBorrowedChange > 0) {
      newClaimableRatio += usdiBorrowedChange / (usdiBorrowedChange + poolUsdi);
    } else if (usdiBorrowedChange < 0) {
      const claimableUsdi = claimableRatio * poolUsdi;
      const newLpTokens =
        (lpTokens * (positionBorrowedUsdi + usdiBorrowedChange)) /
        claimableUsdi;
      newClaimableRatio = newLpTokens / (poolLpTokens - lpTokens + newLpTokens);
    }
    positionBorrowedUsdi += usdiBorrowedChange;
    positionBorrowedIasset += iassetBorrowedChange;

    let newPoolUsdi = poolUsdi + usdiBorrowedChange;
    let newPooliAsset = poolIasset + iassetBorrowedChange;

    const positionLoss = poolCoefficient * positionBorrowedUsdi;

    const maxILD =
      (100 * newCollateralAmount - positionLoss) / ilHealthScoreCoefficient;

    const newInvariant = newPoolUsdi * newPooliAsset;

    // Solution 1: Price goes down, IL is in USDi
    let y1 = Math.max((positionBorrowedUsdi - maxILD) / newClaimableRatio, 0);
    const lowerPrice = (y1 * y1) / newInvariant;

    // Solution 2: Price goes up, IL is in iAsset
    let a = positionBorrowedIasset / newInvariant;
    let b = -newClaimableRatio;
    let c = -maxILD;
    let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const upperPrice = (y2 * y2) / newInvariant;

    // Max USDi borrowed position possible before health = 0
    a = ilHealthScoreCoefficient + poolCoefficient;
    b = poolCoefficient * newPoolUsdi - 100 * newCollateralAmount;
    c = -100 * newCollateralAmount * newPoolUsdi;

    return { lower: lowerPrice, upper: upperPrice };
  };

  let startSearch = 0;
  let stopSearch = initData.maxUsdiPosition;
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

  const finalData = calculateEditCometSinglePoolWithUsdiBorrowed(
    tokenData,
    comet,
    cometIndex,
    collateralChange,
    positionGuess - currentUsdiPosition
  );
  return {
    maxCollateralWithdrawable: finalData.maxCollateralWithdrawable,
    usdiPosition: positionGuess,
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
  usdiCost: number;
  lowerPrice: number;
  upperPrice: number;
} => {
  const position = comet.positions[cometIndex];
  const pool = tokenData.pools[position.poolIndex];

  const ilCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const assetCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const borrowedUsdi = toNumber(position.borrowedUsdi);
  const borrowedIasset = toNumber(position.borrowedIasset);
  const lpTokens = toNumber(position.liquidityTokenValue);

  const initPrice = borrowedUsdi / borrowedIasset;
  let poolUsdiAmount = toNumber(pool.usdiAmount);
  let poolIassetAmount = toNumber(pool.iassetAmount);
  let poolPrice = poolUsdiAmount / poolIassetAmount;
  const invariant = poolUsdiAmount * poolIassetAmount;

  const claimableRatio = lpTokens / toNumber(pool.liquidityTokenSupply);
  const invClaimableRatio = 1 - claimableRatio;

  if (Math.abs(initPrice - poolPrice) < 1e-8) {
    const prevHealthScore = getSinglePoolHealthScore(
      cometIndex,
      tokenData,
      comet
    );
    const estData = calculateEditCometSinglePoolWithUsdiBorrowed(
      tokenData,
      comet,
      cometIndex,
      0,
      0
    );
    return {
      usdiCost: 0,
      healthScore: prevHealthScore.healthScore,
      lowerPrice: estData.lowerPrice,
      upperPrice: estData.upperPrice,
    };
  }
  const iAssetDiff = Math.abs(
    borrowedIasset - claimableRatio * poolIassetAmount
  );
  let usdiCost;
  if (initPrice < poolPrice) {
    const iAssetDebt = iAssetDiff / invClaimableRatio;
    // calculate extra usdi comet can claim, iasset debt that comet cannot claim, and usdi amount needed to buy iasset and cover debt
    const newPooliAssetAmount = poolIassetAmount - iAssetDebt;
    const newPoolUsdiAmount = invariant / newPooliAssetAmount;
    const requiredUsdi = invariant / newPooliAssetAmount - poolUsdiAmount;
    const usdiSurplus = claimableRatio * newPoolUsdiAmount - borrowedUsdi;
    usdiCost = requiredUsdi - usdiSurplus;
    poolIassetAmount = newPooliAssetAmount;
    poolUsdiAmount = newPoolUsdiAmount;
  } else {
    const iassetSurplus = iAssetDiff / invClaimableRatio;
    const newPooliAssetAmount = poolIassetAmount + iassetSurplus;
    const newPoolUsdiAmount = invariant / newPooliAssetAmount;
    // calculate extra iAsset comet can claim, usdi debt that comet cannot claim, and amount of usdi gained from trading iasset.
    const usdiDebt = borrowedUsdi - claimableRatio * newPoolUsdiAmount;
    const usdiBurned = poolUsdiAmount - newPoolUsdiAmount;
    usdiCost = usdiDebt - usdiBurned;
    poolIassetAmount = newPooliAssetAmount;
    poolUsdiAmount = newPoolUsdiAmount;
  }

  const newBorrowedUsdi = claimableRatio * poolUsdiAmount;
  const newBorrowedIasset = claimableRatio * poolIassetAmount;
  const prevCollateral = toNumber(
    comet.collaterals[cometIndex].collateralAmount
  );
  const newCollateral = prevCollateral - usdiCost;

  const positionLoss = assetCoefficient * newBorrowedUsdi;

  const healthScore = 100 - positionLoss / newCollateral;

  const maxILD = (100 * newCollateral - positionLoss) / ilCoefficient;

  // Solution 1: Price goes down, IL is in USDi
  let y1 = Math.max((newBorrowedUsdi - maxILD) / claimableRatio, 0);

  // Solution 2: Price goes up, IL is in iAsset
  let a = newBorrowedIasset / invariant;
  let b = -claimableRatio;
  let c = -maxILD;
  let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);

  return {
    usdiCost: usdiCost,
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
  usdiCost: number;
} => {
  const position = comet.positions[cometIndex];
  const pool = tokenData.pools[position.poolIndex];

  const ilCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
  const assetCoefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);

  const borrowedUsdi = toNumber(position.borrowedUsdi);
  const borrowedIasset = toNumber(position.borrowedIasset);
  const lpTokens = toNumber(position.liquidityTokenValue);
  const prevCollateral = getEffectiveUSDCollateralValue(tokenData, comet);

  const initPrice = borrowedUsdi / borrowedIasset;
  let poolUsdiAmount = toNumber(pool.usdiAmount);
  let poolIassetAmount = toNumber(pool.iassetAmount);
  let poolPrice = poolUsdiAmount / poolIassetAmount;
  const invariant = poolUsdiAmount * poolIassetAmount;

  const claimableRatio = lpTokens / toNumber(pool.liquidityTokenSupply);
  const invClaimableRatio = 1 - claimableRatio;

  const prevHealthScore = getHealthScore(tokenData, comet);

  if (Math.abs(initPrice - poolPrice) < 1e-8) {
    return {
      usdiCost: 0,
      healthScore: prevHealthScore.healthScore,
    };
  }

  const iAssetDiff = Math.abs(
    borrowedIasset - claimableRatio * poolIassetAmount
  );
  const usdiDiff = Math.abs(borrowedUsdi - claimableRatio * poolUsdiAmount);
  let usdiCost;
  let ildLoss;
  if (initPrice < poolPrice) {
    const iAssetDebt =
      (borrowedIasset - claimableRatio * poolIassetAmount) / invClaimableRatio;
    // calculate extra usdi comet can claim, iasset debt that comet cannot claim, and usdi amount needed to buy iasset and cover debt
    const newPooliAssetAmount = poolIassetAmount - iAssetDebt;
    const newPoolUsdiAmount = invariant / newPooliAssetAmount;
    const requiredUsdi = invariant / newPooliAssetAmount - poolUsdiAmount;
    const usdiSurplus = claimableRatio * newPoolUsdiAmount - borrowedUsdi;
    usdiCost = requiredUsdi - usdiSurplus;
    ildLoss = usdiDiff * ilCoefficient;
    poolIassetAmount = newPooliAssetAmount;
    poolUsdiAmount = newPoolUsdiAmount;
  } else {
    const iassetSurplus =
      (claimableRatio * poolIassetAmount - borrowedIasset) / invClaimableRatio;
    const newPooliAssetAmount = poolIassetAmount + iassetSurplus;
    const newPoolUsdiAmount = invariant / newPooliAssetAmount;
    // calculate extra iAsset comet can claim, usdi debt that comet cannot claim, and amount of usdi gained from trading iasset.
    const usdiDebt = borrowedUsdi - claimableRatio * newPoolUsdiAmount;
    const usdiBurned = poolUsdiAmount - newPoolUsdiAmount;
    usdiCost = usdiDebt - usdiBurned;
    poolIassetAmount = newPooliAssetAmount;
    poolUsdiAmount = newPoolUsdiAmount;
    const markPrice = toNumber(pool.assetInfo.price)
    ildLoss = iAssetDiff * markPrice * ilCoefficient;
  }

  const newBorrowedUsdi = claimableRatio * poolUsdiAmount;

  const newCollateral = prevCollateral - usdiCost;
  const prevLoss = (100 - prevHealthScore.healthScore) * prevCollateral;
  const newLoss =
    prevLoss - ildLoss - (borrowedUsdi - newBorrowedUsdi) * assetCoefficient;
  const healthScore = 100 - newLoss / newCollateral;

  return {
    usdiCost: usdiCost,
    healthScore: healthScore,
  };
};

export const getUSDiAndiAssetAmountsFromLiquidtyTokens = (
  cometIndex: number,
  comet: Comet,
  tokenData: TokenData
): { usdiClaim: number; iAssetClaim: number } => {
  let position = comet.positions[cometIndex];
  let pool = tokenData.pools[position.poolIndex];

  let lpTokensClaimed = toNumber(position.liquidityTokenValue);
  let totalLpTokens = toNumber(pool.liquidityTokenSupply);

  let claimableRatio = lpTokensClaimed / totalLpTokens;

  return {
    usdiClaim: claimableRatio * toNumber(pool.usdiAmount),
    iAssetClaim: claimableRatio * toNumber(pool.iassetAmount),
  };
};
