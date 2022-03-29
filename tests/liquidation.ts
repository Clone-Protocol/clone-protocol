import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { Incept } from "../sdk/src/idl/incept";
import { Pyth } from "../sdk/src/idl/pyth";
import { MockUsdc } from "../sdk/src/idl/mock_usdc";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";
import {
  Incept as InceptConnection,
  TokenData,
  User,
  CometPositions,
  MintPositions,
  LiquidityPositions,
  Manager,
  Pool,
} from "../sdk/src/incept";
import { createPriceFeed, setPrice, getFeedData } from "./oracle";
import { Network } from "../sdk/src/network";
import { INCEPT_EXCHANGE_SEED } from "./utils";
import { sleep } from "../sdk/src/utils";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;

describe('liquidation testing', function () {
    let inceptClient;
    let walletPubkey;
    let priceFeed;
    let mockUSDCTokenAccountInfo;
    let usdiTokenAccountInfo;
    let iassetTokenAccountInfo;
    let liquidityTokenAccountInfo;
    let mockUSDCMint;

    before('setup incept client', async () => {
        const provider = anchor.Provider.local();
        anchor.setProvider(provider);

        const inceptProgram = anchor.workspace.Incept as Program<Incept>;
        const pythProgram = anchor.workspace.Pyth as Program<Pyth>;
        const mockUSDCProgram = anchor.workspace.MockUsdc as Program<MockUsdc>;

        mockUSDCMint = anchor.web3.Keypair.generate();
        walletPubkey = inceptProgram.provider.wallet.publicKey;
        
        const mockUSDCAccount = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("mock_usdc")],
            mockUSDCProgram.programId
        );


        // @ts-expect-error
        inceptClient = new InceptConnection(
            inceptProgram.programId,
            provider
        ) as InceptConnection;

        await inceptClient.initializeManager();
        
        await inceptClient.initializeUser();

        let price = 10;
        const expo = -7;
        const conf = new BN((price / 10) * 10 ** -expo);
    
        priceFeed = await createPriceFeed(pythProgram, price, expo, conf);

        await mockUSDCProgram.rpc.initialize(mockUSDCAccount[1], {
            accounts: {
              admin: walletPubkey,
              mockUsdcMint: mockUSDCMint.publicKey,
              mockUsdcAccount: mockUSDCAccount[0],
              rent: RENT_PUBKEY,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SYSTEM_PROGRAM_ID,
            },
            signers: [mockUSDCMint],
        });

        await inceptClient.addCollateral(
            walletPubkey,
            7,
            1,
            mockUSDCMint.publicKey
        );

        await inceptClient.initializePool(walletPubkey, 150, 200, priceFeed);

        await sleep(200);

        const tokenData = await inceptClient.getTokenData()
        const pool = tokenData.pools[0];

        mockUSDCTokenAccountInfo = await inceptClient.fetchOrCreateAssociatedTokenAccount(mockUSDCMint.publicKey);
        usdiTokenAccountInfo = await inceptClient.fetchOrCreateAssociatedTokenAccount(inceptClient.manager.usdiMint);
        liquidityTokenAccountInfo = await inceptClient.fetchOrCreateAssociatedTokenAccount(pool.liquidityTokenMint);
        iassetTokenAccountInfo = await inceptClient.fetchOrCreateAssociatedTokenAccount(pool.assetInfo.iassetMint);

        await mockUSDCProgram.rpc.mintMockUsdc(mockUSDCAccount[1], {
            accounts: {
            mockUsdcMint: mockUSDCMint.publicKey,
            mockUsdcTokenAccount: mockUSDCTokenAccountInfo.address,
            mockUsdcAccount: mockUSDCAccount[0],
            tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [],  
        });

        // @ts-ignore
        let signers: Array<Signer> = [provider.wallet.payer];
    
        await inceptClient.mintUsdi(
            new BN(100000000000000),
            usdiTokenAccountInfo.address,
            mockUSDCTokenAccountInfo.address,
            0,
            signers
        );

        await sleep(200);

        await inceptClient.initializeMintPositions(
            new BN(20000000000000),
            new BN(200000000000000),
            mockUSDCTokenAccountInfo.address,
            iassetTokenAccountInfo.address,
            0,
            0,
            signers
        );

        await inceptClient.initializeLiquidityPosition(
            new BN(10000000000000),
            usdiTokenAccountInfo.address,
            iassetTokenAccountInfo.address,
            liquidityTokenAccountInfo.address,
            0
        );

    });

    it("comet liquidation lower price breached!", async () => {

        await sleep(2000);

        // Initialize a comet
        await inceptClient.initializeComet(
            mockUSDCTokenAccountInfo.address,
            new BN(2500000000),
            new BN(50000000000),
            0,
            0
          );
        // Make a trade to trigger the price
        await inceptClient.sellSynth(
            new BN(4500000000000),
            usdiTokenAccountInfo.address,
            iassetTokenAccountInfo.address,
            0
        );

        const {userPubkey, _bump} = await inceptClient.getUserAddress();
        
        let cometPositions = await inceptClient.getCometPositions();

        assert.equal(Number(cometPositions.numPositions), 1, 'check comet was initialized');

        await inceptClient.liquidateComet(
            userPubkey, 0
        )

        await sleep(200)

        await inceptClient.claimLiquidatedComet(0);

        await sleep(200);

        cometPositions = await inceptClient.getCometPositions();

        assert.equal(Number(cometPositions.numPositions), 0, 'check comet was closed/liquidated');
        
    });

    it("comet liquidation upper price breached!", async () => {

        await sleep(2000);

        // // Initialize a comet
        await inceptClient.initializeComet(
            mockUSDCTokenAccountInfo.address,
            new BN(2500000000),
            new BN(50000000000),
            0,
            0
          );
        // Make a trade to trigger the price
        await inceptClient.buySynth(
            new BN(4200000000000),
            usdiTokenAccountInfo.address,
            iassetTokenAccountInfo.address,
            0
        );

        const {userPubkey, _bump} = await inceptClient.getUserAddress();
        
        let cometPositions = await inceptClient.getCometPositions();

        assert.equal(Number(cometPositions.numPositions), 1, 'check comet was initialized');

        await inceptClient.liquidateComet(
            userPubkey, 0
        )

        await sleep(200)

        await inceptClient.claimLiquidatedComet(0);

        await sleep(200);

        cometPositions = await inceptClient.getCometPositions();

        assert.equal(Number(cometPositions.numPositions), 0, 'check comet was closed/liquidated');
    });

});
  