

exports.fetchBorrowStats = async ({filter, interval, pool}, db) => {
    const query = fetchBorrowStatsQuery({filter, interval, pool})
    const result = await db.any(query)
    return result
}

const fetchBorrowStatsQuery = ({filter, interval, pool}) => {
    // TODO: Remove unneeded args.
    const query = `
        select 
        	pool_index,
        	max(to_timestamp(block_time)) as time_interval,
        	sum(borrowed_delta) as cumulative_borrowed_delta,
        	sum(collateral_delta) as cumulative_collateral_delta
        from borrow_update
        group by pool_index
        UNION all
        select 
        	pool_index,
        	max(to_timestamp(block_time)) as time_interval,
        	sum(borrowed_delta) as cumulative_borrowed_delta,
        	sum(collateral_delta) as cumulative_collateral_delta
        from borrow_update
        where to_timestamp(block_time) < now() - interval '24 hours'
        group by pool_index
        order by time_interval, pool_index
    `
    return query;
  }

