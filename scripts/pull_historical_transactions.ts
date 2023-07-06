import fs from "fs"
import { Connection, PublicKey, ConfirmedSignatureInfo, TransactionResponse, VersionedTransactionResponse } from "@solana/web3.js"

const fetchHistoricalTxnSignatures = async (connection: Connection, address: PublicKey): Promise<ConfirmedSignatureInfo[]> => {
    let historicalSignatures: ConfirmedSignatureInfo[] = []
    let before: string | undefined = undefined

    while (true) {
        console.log("BEFORE:", before)
        let signatureList = await connection.getSignaturesForAddress(address, {limit: 1000, before});
        if (signatureList.length === 0) {
            console.log(historicalSignatures.length)
            break
        }

        signatureList.forEach((tx: ConfirmedSignatureInfo) => {
            historicalSignatures.push(tx)
        })
        before = historicalSignatures.at(-1)?.signature
    }

    return historicalSignatures
}

const fetchTransactions = async (connection: Connection, signatures: (string | undefined)[]) => {

    const batchSize = 20;
    let transactionsHistory: VersionedTransactionResponse[] = []

    for (let i = 0; i < Math.ceil(signatures.length / batchSize); i++) {
        const startIndex = i * batchSize;
        const endIndex = startIndex + batchSize
        const transactions = await connection.getTransactions(
            signatures.slice(startIndex, endIndex).filter(s => s !== undefined).map(s => s!),
            {maxSupportedTransactionVersion: 1}
        )   
        transactions.forEach(s => {
            if (s) {
                transactionsHistory.push(s)
            }
        }) 
    }

    return transactionsHistory
}


const main = async () => {
    const outfilePath = process.env.OUTFILE!
    const programID = new PublicKey(process.env.PROGRAM_ID!)
    const providerUrl = process.env.PROVIDER_URL!

    const connection = new Connection(providerUrl, {commitment: 'confirmed'})

    const signatures = await fetchHistoricalTxnSignatures(connection, programID)

    const transactions = await fetchTransactions(connection, signatures.map(s => s.signature))

    console.log(transactions)

    fs.writeFile(
        outfilePath, JSON.stringify(transactions), err => console.log(err)
    )
}

main().then()