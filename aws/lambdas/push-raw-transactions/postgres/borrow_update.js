exports.createTable = async (db) => {
  await db.none(`
      CREATE TABLE IF NOT EXISTS borrow_update (
        id SERIAL PRIMARY KEY,
        block_time INTEGER NOT NULL,
        slot BIGINT NOT NULL,
        event_id INTEGER NOT NULL,
        pool_index INTEGER NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        is_liquidation BOOLEAN NOT NULL,
        collateral_supplied BIGINT NOT NULL,
        collateral_delta BIGINT NOT NULL,
        collateral_index INTEGER NOT NULL,
        borrowed_amount BIGINT NOT NULL,
        borrowed_delta BIGINT NOT NULL,
      );
      
      CREATE INDEX IF NOT EXISTS borrow_update_block_time_idx ON borrow_update (block_time);
    `);
  return;
};

exports.insertEvent = async (db, event) => {
  await db.none(
    "INSERT INTO borrow_update (block_time, slot, event_id, pool_index, user_id, is_liquidation, collateral_supplied, collateral_delta, collateral_index, borrowed_amount, borrowed_delta) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
    [
      event.blockTime,
      event.slot,
      event.eventId,
      event.poolIndex,
      event.userId,
      event.isLiquidation,
      event.collateralSupplied,
      event.collateralDelta,
      event.collateralIndex,
      event.borrowedAmount,
      event.borrowedDelta,
    ]
  );
  return;
};

exports.insertEvents = async (pgp, db, events) => {
  // Generate a multi-row INSERT query using the pg-promise helpers
  const columns = [
    "block_time",
    "slot",
    "event_id",
    "pool_index",
    "user_id",
    "is_liquidation",
    "collateral_supplied",
    "collateral_delta",
    "collateral_index",
    "borrowed_amount",
    "borrowed_delta",
  ];
  const query = pgp.helpers.insert(events, columns, "borrow_update");

  // Execute the query to insert all events in a single transaction
  await db.none(query);
};
