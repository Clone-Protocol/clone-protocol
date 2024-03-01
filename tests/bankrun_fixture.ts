
import { startAnchor } from "solana-bankrun";

exports.mochaGlobalSetup = async function () {
    this.bankrunContext = await startAnchor(".", [], []);
    console.log(`Bankrun context initialized`);
};