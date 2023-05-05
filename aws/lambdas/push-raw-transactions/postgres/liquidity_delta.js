exports.createTable = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS liquidity_delta (
      id SERIAL PRIMARY KEY,
      block_time INTEGER NOT NULL,
      slot BIGINT NOT NULL,
      event_id INTEGER NOT NULL,
      pool_index INTEGER NOT NULL,
      is_concentrated BOOLEAN NOT NULL,
      iasset_delta BIGINT NOT NULL,
      usdi_delta BIGINT NOT NULL,
      lp_token_delta BIGINT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS liquidity_delta_block_time_idx ON liquidity_delta (block_time);
  `);
  return
    
}

exports.insertEvent = async (db, event) => {
  await db.none(
    "INSERT INTO liquidity_delta (block_time, slot, event_id, pool_index, is_concentrated, iasset_delta, usdi_delta, lp_token_delta) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [event.blockTime, event.slot, event.eventId, event.poolIndex, event.isConcentrated, event.iassetDelta, event.usdiDelta, event.lpTokenDelta]
  );
  return
}
