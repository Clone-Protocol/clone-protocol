const liquidityDelta = require("./liquidity_delta");
const poolState = require("./pool_state");
const swapEvent = require("./swap_event");
const borrowUpdate = require("./borrow_update");

exports.pushEventsToPg = async (db, { type, event }) => {
  switch (String(type)) {
    case "LiquidityDelta":
      await liquidityDelta.createTable(db);
      await liquidityDelta.insertEvent(db, event);
      break;
    case "PoolState":
      await poolState.createTable(db);
      await poolState.insertEvent(db, event);
      break;
    case "SwapEvent":
      await swapEvent.createTable(db);
      await swapEvent.insertEvent(db, event);
      break;
    case "BorrowUpdate":
      await borrowUpdate.createTable(db);
      await borrowUpdate.insertEvent(db, event);
      break;
    default:
      throw new Error(`Unknown type: ${type}`);
  }
};
