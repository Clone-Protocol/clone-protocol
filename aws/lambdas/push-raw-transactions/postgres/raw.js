exports.createTable = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS raw_transactions (
      id SERIAL PRIMARY KEY,
      block_time INTEGER NOT NULL,
      slot BIGINT NOT NULL,
      index_within_block INTEGER NOT NULL,
      raw JSONB NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS raw_transactions_block_time_idx ON raw_transactions (block_time);
    CREATE INDEX IF NOT EXISTS raw_transactions_slot_idx ON raw_transactions (slot);
  `);
  return
}

exports.insertEvent = async (db, event) => {
  console.log("EVENT VALUES:", event)
  await db.none(
    "INSERT INTO raw_transactions (block_time, slot, index_within_block, raw) VALUES ($1, $2, $3, $4)",
    [event.blockTime, event.slot, event. indexWithinBlock, event.raw]
  );
  return
}