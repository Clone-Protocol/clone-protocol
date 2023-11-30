import { depositoryTokenTests } from "./depository-token";
import { cloneTests } from "./clone";
import { liquiditySimulation } from "./liquidity_test";

if (process.env.LIQUIDITY_SIMULATION === "1") {
    liquiditySimulation();
} else {
    depositoryTokenTests();
    cloneTests()
}
