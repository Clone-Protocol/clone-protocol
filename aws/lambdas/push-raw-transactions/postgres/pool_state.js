exports.createTable = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS pool_state (
      id BIGSERIAL PRIMARY KEY,
      block_time BIGINT NOT NULL,
      slot BIGINT NOT NULL,
      event_id BIGINT NOT NULL,
      pool_index SMALLINT NOT NULL,
      onasset_ild BIGINT NOT NULL,
      onusd_ild BIGINT NOT NULL,
      committed_onusd_liquidity BIGINT NOT NULL,
      oracle_price BIGINT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS pool_state_block_time_idx ON pool_state (block_time);
  `);
  return;
};

exports.insertEvent = async (db, event) => {
  await db.none(
    "INSERT INTO pool_state (block_time, slot, event_id, pool_index, onasset_ild, onusd_ild, committed_onusd_liquidity, oracle_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      event.blockTime,
      event.slot,
      event.eventId,
      event.poolIndex,
      event.onassetIld,
      event.onusdIld,
      event.committedOnusdLiquidity,
      event.oraclePrice,
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
    "onasset_ild",
    "onusd_ild",
    "committed_onusd_liquidity",
    "oracle_price",
  ];
  const query = pgp.helpers.insert(events, columns, "pool_state");

  // Execute the query to insert all events in a single transaction
  await db.none(query);
};
