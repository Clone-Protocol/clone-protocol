const anchor = require("@coral-xyz/anchor")
const cloneIDL = require("./clone.json")

const parseEvent = (
  log,
  slot,
  blockTime
) => {
  const data = log.data;
  const eventId = data.eventId.toNumber();
  const type = log.name
  let event;

  switch (type) {
    case "LiquidityDelta":
      event = {
        blockTime,
        slot,
        eventId,
        poolIndex: data.poolIndex,
        userAddress: data.userAddress,
        committedOnusdDelta: data.committedOnusdDelta.toString(),
        onusdIldDelta: data.onusdIldDelta.toString(),
        onassetIldDelta: data.onassetIldDelta.toString(),
      }
      break;
    case "PoolState":
      event = {
        blockTime,
        slot,
        eventId,
        poolIndex: data.poolIndex,
        onassetIld: data.onassetIld.toString(),
        onusdIld: data.onusdIld.toString(),
        committedOnusdLiquidity: data.committedOnusdLiquidity.toString(),
        oraclePrice: data.oraclePrice.toString(),
      };
      break;
    case "SwapEvent":
      event = {
        blockTime,
        slot,
        eventId,
        userAddress: data.userAddress.toString(),
        poolIndex: data.poolIndex,
        isBuy: data.isBuy,
        onasset: data.onasset.toString(),
        onusd: data.onusd.toString(),
        tradingFee: data.tradingFee.toString(),
        treasuryFee: data.treasuryFee.toString(),
      };
      break;
    case "BorrowUpdate":  
      event = {
        blockTime,
        slot,
        eventId,
        poolIndex: data.poolIndex,
        userAddress: data.userAddress.toString(),
        isLiquidation: data.isLiquidation,
        collateralSupplied: data.collateralSupplied.toString(),
        collateralDelta: data.collateralDelta.toString(),
        collateralIndex: data.collateralIndex,
        borrowedAmount: data.borrowedAmount.toString(),
        borrowedDelta: data.borrowedDelta.toString(),
      }
      break;
    default:
      throw new Error(`Event type: ${type} not recognized!`);
  }
  return { type, event };
};

exports.extract = (raw) => {

    const connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl("devnet"))
    const programID = new anchor.web3.PublicKey(cloneIDL.metadata.address)
    const program = new anchor.Program(cloneIDL, programID, { connection })
    const parser = new anchor.EventParser(programID, program.coder);

    let parsedEvents = [];
    const slot = raw.slot
    const blockTime = raw.blockTime
    const indexWithinBlock = raw.indexWithinBlock
    const meta = raw.meta
    const logMessages = meta.logMessages

    if (logMessages) {
        for (let log of parser.parseLogs(meta.logMessages))  {
          parsedEvents.push(parseEvent(log, slot, blockTime));
        }
    }

    return {
        blockTime,
        indexWithinBlock,
        slot,
        parsedEvents
    }
}
