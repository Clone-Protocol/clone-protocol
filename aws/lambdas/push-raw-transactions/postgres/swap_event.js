exports.createTable = async (db) => {
  await db.none(`
    CREATE TABLE IF NOT EXISTS swap_event (
      id SERIAL PRIMARY KEY,
      block_time BIGINT NOT NULL,
      slot BIGINT NOT NULL,
      event_id INTEGER NOT NULL,
      user_address VARCHAR(50) NOT NULL,
      pool_index SMALLINT NOT NULL,
      input_is_onusd BOOLEAN NOT NULL,
      input BIGINT NOT NULL,
      output BIGINT NOT NULL,
      trading_fee BIGINT NOT NULL,
      treasury_fee BIGINT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS events_block_time_idx ON swap_event (block_time);
  `);
  return;
};

exports.insertEvent = async (db, event) => {
  await db.none(
    "INSERT INTO swap_event (block_time, slot, event_id, user_address, pool_index, input_is_onusd, input, output, trading_fee, treasury_fee) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    [
      event.blockTime,
      event.slot,
      event.eventId,
      event.userAddress,
      event.poolIndex,
      event.inputIsOnusd,
      event.input,
      event.output,
      event.tradingFee,
      event.treasuryFee,
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
    "user_id",
    "pool_index",
    "input_is_onusd",
    "input",
    "output",
    "trading_fee",
    "treasury_fee",
  ];
  const query = pgp.helpers.insert(events, columns, "swap_event");

  // Execute the query to insert all events in a single transaction
  await db.none(query);
};
