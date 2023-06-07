exports.createTable = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS liquidity_delta (
      id SERIAL PRIMARY KEY,
      block_time INTEGER NOT NULL,
      slot BIGINT NOT NULL,
      event_id INTEGER NOT NULL,
      user_id VARCHAR(50) NOT NULL,
      pool_index INTEGER NOT NULL,
      is_concentrated BOOLEAN NOT NULL,
      iasset_delta BIGINT NOT NULL,
      onusd_delta BIGINT NOT NULL,
      lp_token_delta BIGINT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS liquidity_delta_block_time_idx ON liquidity_delta (block_time);
  `);
  return;
};

exports.insertEvent = async (db, event) => {
  await db.none(
    "INSERT INTO liquidity_delta (block_time, slot, event_id, pool_index, is_concentrated, iasset_delta, onusd_delta, lp_token_delta) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      event.blockTime,
      event.slot,
      event.eventId,
      event.poolIndex,
      event.isConcentrated,
      event.iassetDelta,
      event.onusdDelta,
      event.lpTokenDelta,
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
    "is_concentrated",
    "iasset_delta",
    "onusd_delta",
    "lp_token_delta",
  ];
  const query = pgp.helpers.insert(events, columns, "liquidity_delta");

  // Execute the query to insert all events in a single transaction
  await db.none(query);
};
