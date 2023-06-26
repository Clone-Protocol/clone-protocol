

exports.fetchOhlcv = async ({interval, filter, pool}, db) => {
    const query = getOhlcvQuery({interval, filter, pool})
    console.log(query)
    const result = await db.any(query)

    return result
}

const getOhlcvQuery = ({interval, filter, pool}) => {
  
    // Generate the SQL query string with the provided interval and filter
    const query = `
    WITH trades AS (
        SELECT
            pool_index,
            date_trunc('${interval}', to_timestamp(block_time)) AS time_interval,
            (CASE WHEN input_is_onusd THEN input::numeric / output::numeric ELSE output::numeric/input::numeric END) AS price,
            (CASE WHEN input_is_onusd THEN input::numeric * 2 ELSE output::numeric * 2 END) AS volume,
            trading_fee + treasury_fee AS fees
        FROM
            swap_event
        WHERE
            block_time >= EXTRACT(EPOCH FROM now() - interval '1 ${filter}')
    ),
    open_close_prices AS (
        SELECT
            pool_index,
            time_interval,
            FIRST_VALUE(price) OVER (PARTITION BY pool_index, time_interval ORDER BY time_interval) AS open,
            LAST_VALUE(price) OVER (PARTITION BY pool_index, time_interval ORDER BY time_interval) AS close
        FROM
            trades
    )
    SELECT
        time_interval,
        MIN(price) AS low,
        MAX(price) AS high,
        AVG(open) AS open,
        AVG(close) AS close,
        SUM(volume) AS volume,
        SUM(fees) AS trading_fees
    FROM
        trades
        JOIN open_close_prices USING (pool_index, time_interval)
    WHERE pool_index = ${pool}
    GROUP BY
        time_interval
    ORDER BY
        time_interval;
    `;
  
    return query;
  }

