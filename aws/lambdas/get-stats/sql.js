
exports.fetchStats = async ({pool, interval}, db) => {
    const query = getStatsQuery(pool, interval)
    const result = await db.any(query)
    return result
}

const getStatsQuery = (pool, interval) => {
  const token = pool === undefined ? ' ' : ` WHERE pool_index = ${pool} `
  return `
  WITH daily_latest AS (
    SELECT
      date_trunc('${interval}', to_timestamp(block_time)) AS date,
      pool_index,
      iasset,
      usdi,
      ROW_NUMBER() OVER (PARTITION BY date_trunc('${interval}', to_timestamp(block_time)), pool_index ORDER BY block_time DESC) AS row_number
    FROM
      pool_state
  ),
  
  daily_liquidity AS (
    SELECT
      date,
      pool_index,
      2 * usdi AS liquidity
    FROM
      daily_latest
    WHERE
      row_number = 1
  ),
  
  pool_trading_volume AS (
    SELECT
      date_trunc('${interval}', to_timestamp(block_time)) AS date,
      pool_index,
      SUM(2 * usdi) AS trading_volume,
      SUM(trading_fee) AS total_trading_fees,
      SUM(treasury_fee) AS total_treasury_fees
    FROM
      swap_event
    GROUP BY
      date,
      pool_index
  ),
  
  pool_liquidity AS (
    SELECT
      COALESCE(daily_liquidity.date, pool_trading_volume.date) AS datetime,
      COALESCE(daily_liquidity.pool_index, pool_trading_volume.pool_index) AS pool_index,
      COALESCE(daily_liquidity.liquidity, 0) AS total_liquidity,
      COALESCE(pool_trading_volume.trading_volume, 0) AS trading_volume,
      COALESCE(pool_trading_volume.total_trading_fees, 0) AS total_trading_fees,
      COALESCE(pool_trading_volume.total_treasury_fees, 0) AS total_treasury_fees
    FROM
      daily_liquidity
    FULL OUTER JOIN
      pool_trading_volume
    ON
      daily_liquidity.date = pool_trading_volume.date
      AND daily_liquidity.pool_index = pool_trading_volume.pool_index
  ),
  
  latest_entries AS (
    SELECT * FROM pool_liquidity ORDER BY datetime DESC LIMIT 1000
  )
  
  SELECT * FROM latest_entries${token}ORDER BY datetime, pool_index;
  `
}
