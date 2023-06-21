

exports.fetchSwaps = async ({filter, user, pool}, db) => {
    const query = fetchSwapsQuery({filter, user, pool})
    const result = await db.any(query)
    return result
}

const fetchSwapsQuery = ({filter, user, pool}) => {
    // Generate the SQL query string with the provided interval and filter
    const query = `
        SELECT
            event_id,
            slot,
            to_timestamp(block_time) AS timestamp,
            onusd::numeric / iasset::numeric AS price,
            iasset::numeric AS amount,
            trading_fee + treasury_fee AS fees,
            is_buy
        FROM
            swap_event
        WHERE
            pool_index = ${pool} AND
            user_id = '${user}' AND
            block_time >= EXTRACT(EPOCH FROM now() - interval '1 ${filter}')
        LIMIT 1000;
    `;
    return query;
  }

