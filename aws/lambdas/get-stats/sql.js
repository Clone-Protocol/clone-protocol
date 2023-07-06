
exports.fetchStats = async ({interval, filter}, db) => {
    const query = getStatsQuery(interval, filter)
    const result = await db.any(query)
    return result
}

const getStatsQuery = (interval, filter) => {
	return `
		WITH trades AS (
			SELECT
				pool_index,
				date_trunc('${interval}', to_timestamp(block_time)) AS time_interval,
				(CASE WHEN input_is_onusd THEN input::numeric / output::numeric ELSE output::numeric/input::numeric END) AS price,
				(CASE WHEN input_is_onusd THEN input::numeric * 2 ELSE output::numeric * 2 END) AS volume,
				(CASE WHEN input_is_onusd THEN trading_fee::numeric * input::numeric / output::numeric ELSE trading_fee::numeric END) AS fees
			FROM
				swap_event
			WHERE
				block_time >= EXTRACT(EPOCH FROM now() - interval '1 ${filter}')
		),
		liquidity_query AS (
			SELECT 
				pool_index,
				time_interval, 
				SUM(committed_onusd_liquidity) as total_committed_onusd_liquidity
			FROM 
				(
				SELECT 
					pool_index,
					date_trunc('${interval}', to_timestamp(block_time)) AS time_interval, 
					committed_onusd_liquidity,
					ROW_NUMBER() OVER (PARTITION BY pool_index, date_trunc('${interval}', to_timestamp(block_time)) ORDER BY block_time DESC) as row_number
				FROM 
					pool_state
				WHERE 
					block_time >= EXTRACT(EPOCH FROM (NOW() - interval '1 ${filter}'))
				) AS subquery
			WHERE 
				row_number = 1
			GROUP BY
				pool_index, time_interval
		)
		SELECT
			liquidity_query.pool_index,
			COALESCE(liquidity_query.time_interval, trades.time_interval) AS time_interval,
			liquidity_query.total_committed_onusd_liquidity,
			COALESCE(SUM(volume), 0) AS volume,
			COALESCE(SUM(fees), 0) AS trading_fees
		FROM
			trades
			FULL JOIN liquidity_query ON liquidity_query.time_interval = trades.time_interval
				AND liquidity_query.pool_index = trades.pool_index
		GROUP BY
			liquidity_query.pool_index,
			COALESCE(liquidity_query.time_interval, trades.time_interval), 
			total_committed_onusd_liquidity
		ORDER BY
			time_interval;
		`
}
