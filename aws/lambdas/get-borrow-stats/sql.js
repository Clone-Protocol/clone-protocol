

exports.fetchBorrowStats = async ({filter, interval, pool}, db) => {
    const query = fetchBorrowStatsQuery({filter, interval, pool})
    const result = await db.any(query)
    return result
}

const fetchBorrowStatsQuery = ({filter, interval, pool}) => {
    // Generate the SQL query string with the provided interval and filter
    const sub = pool !== undefined ? `WHERE pool_index = ${pool}` : ''
    const query = `
    SELECT 
        pool_index, 
        time_interval, 
        cumulative_collateral_delta, 
        cumulative_borrowed_delta 
    FROM (
        SELECT 
            pool_index, 
            date_trunc('${interval}', to_timestamp(block_time)) AS time_interval, 
            SUM(collateral_delta) OVER (PARTITION BY pool_index ORDER BY block_time ROWS UNBOUNDED PRECEDING) as cumulative_collateral_delta,
            SUM(borrowed_delta) OVER (PARTITION BY pool_index ORDER BY block_time ROWS UNBOUNDED PRECEDING) as cumulative_borrowed_delta,
            ROW_NUMBER() OVER (PARTITION BY pool_index, date_trunc('${interval}', to_timestamp(block_time)) ORDER BY block_time DESC) as rn,
            block_time
        FROM 
            borrow_update
        ${sub}
    ) subquery
    WHERE rn = 1
    AND block_time >= EXTRACT(EPOCH FROM (NOW() - interval '1 ${filter}'))::bigint
    ORDER BY 
        pool_index, 
        time_interval;
    `;
    return query;
  }

