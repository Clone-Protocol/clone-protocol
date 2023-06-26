

describe("sql tests", () => {
    it("query and parse ohlcv", async () => {
        const sql = require('../sql')
        const pgp = require("pg-promise")();
        const db = pgp(process.env.PG_CONNECTION);
        const result = await sql.fetchOhlcv({interval: 'day', filter: 'year', pool: 0}, db)
        console.log("RESULT:", result)
    })
})