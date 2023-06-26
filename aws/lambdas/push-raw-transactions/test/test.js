const extract = require("../extract_values")

describe("parsing data tests", () => {

    it("parse PayBorrowDebt transaction", () => {
        const event = require("./test0.json")
        console.log(event)
        const result = extract.extract(event)
        console.log(result.parsedEvents)
    })

    it("parse Swap transaction", () => {
        const event = require("./test1.json")
        const result = extract.extract(event)
        console.log(result.parsedEvents)
    })

    it("parse AddLiquidityToComet transaction", async () => {
        const event = require("./test2.json")
        const result = extract.extract(event)
        console.log(result.parsedEvents)
    })

    // it("push historical", async () => {

    // const liquidityDeltaCon = require('../postgres/liquidity_delta')
    // const poolStateCon = require('../postgres/pool_state')
    // const swapEventCon = require('../postgres/swap_event')
    // const rawCon = require('../postgres/raw')
    // const helper = require('../postgres/helper')
    //     const rawTransactions = require("./output.json")
    //     let rawData = []
    //     let swapEvent = []
    //     let liquidityDelta = []
    //     let poolState = []


    //     for (let i = 0; i < rawTransactions.length; i++) {
    //         let raw = rawTransactions[i];
    //         let { blockTime, indexWithinBlock, slot, parsedEvents } = extract.extract(raw)
    //         rawData.push({block_time: blockTime, index_within_block: indexWithinBlock, slot, raw})
    //         for (const parsed of parsedEvents) {
    //             let {type, event} = parsed
    //             let eventSc = helper.convertKeysToSnakeCase(event)
    //             switch ( type ) {
    //                 case 'LiquidityDelta':
    //                     liquidityDelta.push(eventSc)
    //                     break
    //                 case 'PoolState':
    //                     poolState.push(eventSc)
    //                     break
    //                 case 'SwapEvent':
    //                     swapEvent.push(eventSc)
    //                     break
    //                 default:
    //                     throw new Error("Unknown type: ", type)
    //             }
    //         }
    //     }
    //     console.log(rawData.length)
    //     console.log(swapEvent.length)
    //     console.log(liquidityDelta.length)
    //     console.log(poolState.length)

    //     const pgp = require("pg-promise")();
    //     const db = pgp(process.env.PG_CONNECTION);
    //     await swapEventCon.createTable(db)
    //     await swapEventCon.insertEvents(pgp, db, swapEvent)
    //     await poolStateCon.createTable(db)
    //     await poolStateCon.insertEvents(pgp, db, poolState)

    // })

})