const sql = require('./sql')
const pgp = require("pg-promise")();
const db = pgp(process.env.PG_CONNECTION);
const redis = require('redis');

// Connect to Redis ElastiCache
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

const validateInputs = ({interval, filter, pool}) => {
    // Validate interval and filter inputs
    const validIntervals = ["minute", "hour", "day"];
    const validFilters = ["day", "week", "month", "year"];
    
    if (!validIntervals.includes(interval)) {
        throw new Error(`Invalid interval: ${interval}. Must be one of ${validIntervals.join(', ')}`);
    }
    
    if (!validFilters.includes(filter)) {
        throw new Error(`Invalid filter: ${filter}. Must be one of ${validFilters.join(', ')}`);
    }

    let num = Number(pool)
    if (!(Number.isInteger(num) && num >= 0)) {
        throw new Error(`Invalid pool: ${pool}. Must be a non-negative integer.`)
    }
}

const getCacheExpiration = (interval) => {
    const currentTimestamp = Math.ceil(Date.now() * 1e-3)
    const secondsInterval = (() => {
        switch (interval) {
            case 'minute':
                return 60;
            case 'hour':
                return 3600;
            case 'day':
                return 86400;
            default:
                throw new Error(`Unrecognized interval ${interval}`)
        }
    })()
    return secondsInterval - currentTimestamp % secondsInterval
}

exports.handler = async (event) => {

    console.log("EVENT:",event)
    const params = (event.params?.querystring) ? event.params.querystring : event
    console.log("PARAMS", params)

    try {
        validateInputs(params)
    } catch (err) {
        return {
            statusCode: 400,
            body: JSON.stringify(err)
        }
    }

    let statusCode = 200;
    let body;

    try {
        const key = `${params.interval}:${params.filter}:${params.pool}`
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
            const data = await sql.fetchOhlcv(params, db)
            await redisClient.set(key, JSON.stringify(data), {'EX': getCacheExpiration(params.interval)})
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
