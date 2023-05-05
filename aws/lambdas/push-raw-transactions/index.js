const extract = require("./extract_values")
const rawTransactions = require("./postgres/raw")
const pg = require("./postgres/index")
const pgp = require("pg-promise")();
const db = pgp(process.env.PG_CONNECTION);

exports.handler = async (event, context) => {
    console.log('EVENT:', JSON.stringify(event, null, 2));
    const raw = event[0]

    const {blockTime, indexWithinBlock, slot, parsedEvents} = extract.extract(raw)

    // Push raw transaction
    await rawTransactions.createTable(db)
    await rawTransactions.insertEvent(db, {blockTime, slot, indexWithinBlock, raw})
    console.log("PARSED EVENTS:", parsedEvents)

    for (const parsedEvent of parsedEvents) {
        await pg.pushEventsToPg(db, parsedEvent)
    }

    let body = "OK";
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json',
    };

    return {
        statusCode,
        body,
        headers,
    };
};
