import fs from "fs"
import axios from "axios"
import {VersionedTransactionResponse} from "@solana/web3.js"
import { sleep } from "../sdk/src/utils"

const pushTransaction = async (data: string, endpoint: string, authorization: string) => {
    const config = {
        headers: {
          'authorization': authorization
        }
      };

    let res = await axios.post(endpoint, data, config)
}

const main = async () => {
    const outfilePath = process.env.OUTFILE!
    const endpointURL = process.env.ENDPOINT_URL!
    const authorization = process.env.AUTHORIZATION!

    const data = fs.readFileSync(outfilePath, 'utf-8')
    const txns: VersionedTransactionResponse[] = JSON.parse(data)

    for (const tx of txns.reverse()) {
        pushTransaction(`[${JSON.stringify(tx)}]`, endpointURL, authorization)
        await sleep(500)
    }

}

main().then()