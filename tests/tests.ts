import { depositoryTokenTests } from "./depository-token";
// import { cloneTests } from clone;
import * as anchor from "@coral-xyz/anchor";
import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
// depositoryTokenTests();
// cloneTests


describe("running test suite", async function () {

    before(async function () {
        this.bankrunContext = await startAnchor(".", [], []);
        this.bankrunProvider = new BankrunProvider(this.bankrunContext);
        this.provider = new anchor.AnchorProvider(this.bankrunProvider.connection, new anchor.Wallet(this.bankrunContext.payer), {commitment: "confirmed"})
    });

    it("should run depository token tests", async function () {
        console.log("ok?", this.bankrunContext)

    })
    
})
