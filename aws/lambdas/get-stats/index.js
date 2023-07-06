const sql = require('./sql')
const pgp = require("pg-promise")();
const db = pgp(process.env.PG_CONNECTION);
const redis = require('redis');

// Connect to Redis ElastiCache
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

const validateInputs = ({interval, filter}) => {
    // Validate interval and filter inputs

    const validIntervals = ['day', 'hour']
    console.log("INTERVAL:", interval, validIntervals.includes(interval))
    if (!validIntervals.includes(interval)) {
        throw new Error(`Invalid interval: ${interval}. Must be one of ${validIntervals.join(', ')}`);
    }
    
    const validFilters = ["day", "week", "month", "year"];
    if (!validFilters.includes(filter)) {
        throw new Error(`Invalid filter: ${filter}. Must be one of ${validFilters.join(', ')}`);
    }
}

const getExpiration = (interval) => {
    const currentTimestamp = Math.ceil(Date.now() * 1e-3)

    if (interval === 'day') {
        return 86400 - currentTimestamp % 86400
    }

    return 3600 - currentTimestamp % 3600
}

exports.handler = async (event, context) => {
    
    console.log("EVENT:",event)
    const params = (event.params?.querystring) ? event.params.querystring : event
    console.log("PARAMS", params)

    try {
        validateInputs(params)
    } catch (err) {
        return {
            statusCode: 400,
            body: JSON.stringify(err.message)
        }
    }

    let statusCode = 200;
    let body;

    try {
        const key = `stats:${params.interval}:${params.filter}`
        // Try to get from cache
        console.log("CONNECTING REDIS")
        await redisClient.connect()
        console.log("QUERYING REDIS AT:", key)
        const cachedData = await redisClient.get(key);

        if (cachedData) {
            console.log("RETURNING CACHED DATA")
            body = JSON.parse(cachedData);
        } else {
            // Run sql query and cache result
            console.log("QUERYING RESULT")
            const data = await sql.fetchStats(params, db)
            await redisClient.set(key, JSON.stringify(data), {'EX': getExpiration(params.interval)})
            body = data;
        }
    } catch (err) {
        console.log("ERROR:", err)
        statusCode = 500,
        body = "Internal server error!"
    } finally {
        await redisClient.quit()
    }

    return { statusCode, body }  
};
