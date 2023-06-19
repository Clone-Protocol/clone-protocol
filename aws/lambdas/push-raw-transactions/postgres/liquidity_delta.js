exports.createTable = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS liquidity_delta (
      id BIGSERIAL PRIMARY KEY,
      block_time INTEGER NOT NULL,
      slot BIGINT NOT NULL,
      event_id INTEGER NOT NULL,
      pool_index INTEGER NOT NULL,
      user_address VARCHAR(50) NOT NULL,
      committed_onusd_delta BIGINT NOT NULL
      onusd_ild_delta BIGINT NOT NULL,
      onasset_ild_delta BIGINT NOT NULL,
    );
    
    CREATE INDEX IF NOT EXISTS liquidity_delta_block_time_idx ON liquidity_delta (block_time);
  `);
  return;
};

exports.insertEvent = async (db, event) => {
  await db.none(
    "INSERT INTO liquidity_delta (block_time, slot, event_id, pool_index, user_address, committed_onusd_delta, onusd_ild_delta, onasset_ild_delta) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      event.blockTime,
      event.slot,
      event.eventId,
      event.poolIndex,
      event.userAddress,
      event.committedOnusdDelta,
      event.onusdIldDelta,
      event.onassetIldDelta,
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
    "user_address",
    "committed_onusd_delta",
    "onusd_ild_delta",
    "onasset_ild_delta",
  ];
  const query = pgp.helpers.insert(events, columns, "liquidity_delta");

  // Execute the query to insert all events in a single transaction
  await db.none(query);
};
