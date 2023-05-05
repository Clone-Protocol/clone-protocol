const extract = require("../extract_values")
const liquidityDelta = require('../postgres/liquidity_delta')
const poolState = require('../postgres/pool_state')
const swapEvent = require('../postgres/swap_event')



describe("parsing data tests", () => {

    it("parse update prices transaction", () => {
        const event = require("./test0.json")
        const result = extract.extract(event)
        //console.log(result.events)
    })

    it("parse buy synth transaction", () => {
        const event = require("./test1.json")
        const result = extract.extract(event)
        //console.log(result.events)
    })

    it("parse add liquidity transaction", async () => {
        const event = require("./test2.json")
        const result = extract.extract(event)
        console.log(result.parsedEvents)

        // TODO: Fix connection to DB.
        for (const item of result.parsedEvents) {
            const { type, event } = item
            switch ( type ) {
                case 'LiquidityDelta':
                    await liquidityDelta.createTable()
                    await liquidityDelta.insertEvent(event)
                    break
                case 'PoolState':
                    await poolState.createTable()
                    await poolState.insertEvent(event)
                    break
                case 'SwapEvent':
                    await swapEvent.createTable()
                    await swapEvent.insertEvent(event)
                default:
                    throw new Error("Unknown type: ", type)
            }
        }

    })
})