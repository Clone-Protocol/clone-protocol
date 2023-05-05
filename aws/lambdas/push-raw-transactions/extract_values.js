const anchor = require("@coral-xyz/anchor")
const inceptIDL = require("./incept.json")

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
        isConcentrated: data.isConcentrated,
        iassetDelta: data.iassetDelta.toString(),
        usdiDelta: data.usdiDelta.toString(),
        lpTokenDelta: data.lpTokenDelta.toString(),
      }
      break;
    case "PoolState":
      event = {
        blockTime,
        slot,
        eventId,
        poolIndex: data.poolIndex,
        iasset: data.iasset.toString(),
        usdi: data.usdi.toString(),
        lpTokens: data.lpTokens.toString(),
        oraclePrice: data.oraclePrice.toString(),
      };
      break;
    case "SwapEvent":
      event = {
        blockTime,
        slot,
        eventId,
        user: data.user.toString(),
        poolIndex: data.poolIndex,
        isBuy: data.isBuy,
        iasset: data.iasset.toString(),
        usdi: data.usdi.toString(),
        tradingFee: data.tradingFee.toString(),
        treasuryFee: data.treasuryFee.toString(),
      };
      break;
    default:
      throw new Error(`Event type: ${type} not recognized!`);
  }
  return { type, event };
};

exports.extract = (raw) => {

    const connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl("devnet"))
    const programID = new anchor.web3.PublicKey(inceptIDL.metadata.address)
    const program = new anchor.Program(inceptIDL, programID, { connection })
    const parser = new anchor.EventParser(programID, program.coder);

    let parsedEvents = [];
    const slot = raw.slot
    const blockTime = raw.blockTime
    const indexWithinBlock = raw.indexWithinBlock
    const meta = raw.meta
    const logMessages = meta.logMessages

    if (logMessages) {
        for (let log of parser.parseLogs(meta.logMessages))  {
          parsedEvents.push(parseEvent(log, slot, indexWithinBlock, blockTime));
        }
    }

    return {
        blockTime,
        indexWithinBlock,
        slot,
        parsedEvents
    }
}
