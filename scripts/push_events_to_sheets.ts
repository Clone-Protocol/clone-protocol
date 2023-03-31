import * as anchor from "@coral-xyz/anchor";
import { Program, EventParser, AnchorProvider } from "@coral-xyz/anchor";
import { IdlEvent } from "@coral-xyz/anchor/dist/cjs/idl";
import { Incept, IDL } from "../sdk/src/idl/incept";
import {
  PublicKey,
  GetVersionedTransactionConfig,
  TransactionSignature,
} from "@solana/web3.js";
import { GoogleSpreadsheet } from "google-spreadsheet";

type SwapEvent = {
  blockTime: number;
  signature: string;
  slot: number;
  eventId: number;
  user: string;
  poolIndex: number;
  isBuy: boolean;
  iasset: number;
  usdi: number;
  tradingFee: number;
  treasuryFee: number;
};

type PoolState = {
  blockTime: number;
  signature: string;
  slot: number;
  eventId: number;
  poolIndex: number;
  iasset: number;
  usdi: number;
  lpTokens: number;
  oraclePrice: number;
};

type LiquidityDelta = {
  blockTime: number;
  signature: string;
  slot: number;
  eventId: number;
  poolIndex: number;
  isConcentrated: boolean;
  iassetDelta: number;
  usdiDelta: number;
  lpTokenDelta: number;
};

type Event = SwapEvent | PoolState | LiquidityDelta;

enum EventType {
  SwapEvent = "SwapEvent",
  LiquidityDelta = "LiquidityDelta",
  PoolState = "PoolState",
}

type EventData = { type: EventType; event: Event };

const parseEvent = (
  log: anchor.Event<IdlEvent, Record<string, never>>,
  slot: number,
  signature: string,
  blockTime: number
): EventData => {

  const data = log.data;
  const eventId = data.eventId.toNumber();
  const type = log.name as EventType;
  let event;

  switch (type) {
    case EventType.LiquidityDelta:
      event = {
        blockTime,
        signature,
        slot,
        eventId,
        poolIndex: data.poolIndex,
        isConcentrated: data.isConcentrated,
        iassetDelta: data.iassetDelta.toNumber(),
        usdiDelta: data.usdiDelta.toNumber(),
        lpTokenDelta: data.lpTokenDelta.toNumber(),
      } as LiquidityDelta;
      break;
    case EventType.PoolState:
      event = {
        blockTime,
        signature,
        slot,
        eventId,
        poolIndex: data.poolIndex,
        iasset: data.iasset.toNumber(),
        usdi: data.usdi.toNumber(),
        lpTokens: data.lpTokens.toNumber(),
        oraclePrice: data.oraclePrice.toNumber(),
      } as PoolState;
      break;
    case EventType.SwapEvent:
      event = {
        blockTime,
        signature,
        slot,
        eventId,
        user: data.user.toString(),
        poolIndex: data.poolIndex,
        isBuy: data.isBuy,
        iasset: data.iasset.toNumber(),
        usdi: data.usdi.toNumber(),
        tradingFee: data.tradingFee.toNumber(),
        treasuryFee: data.treasuryFee.toNumber(),
      } as SwapEvent;
      break;
    default:
      throw new Error(`Event type: ${type} not recognized!`);
  }

  return { type, event };
};

const getEvents = async (
  inceptProgramID: PublicKey,
  provider: AnchorProvider,
  until?: TransactionSignature
): Promise<EventData[]> => {
  const signatures = await provider.connection.getSignaturesForAddress(
    inceptProgramID,
    { until },
    "finalized"
  );
  const config: GetVersionedTransactionConfig = {
    maxSupportedTransactionVersion: 1,
    commitment: "finalized",
  };

  const txns = await Promise.all(
    signatures.map((s) =>
      provider.connection.getTransaction(s.signature, config)
    )
  );

  let inceptProgram = new Program<Incept>(IDL, inceptProgramID, provider);
  let parser = new EventParser(inceptProgramID, inceptProgram.coder);
  let events: { type: EventType; event: Event }[] = [];

  for (let [i, tx] of txns.entries()) {
    if (tx === null || tx === undefined) continue;
    let signature = signatures[i].signature;
    let slot = tx.slot;
    let blockTime = tx.blockTime!;
    for (let log of parser.parseLogs(tx.meta!.logMessages!)) {
      events.push(parseEvent(log, slot, signature, blockTime));
    }
  }

  return events.reverse();
};

const getDocument = async (
  documentId: string,
  serviceEmail: string,
  servicePrivateKey: string
): Promise<GoogleSpreadsheet> => {
  const doc = new GoogleSpreadsheet(documentId);

  await doc.useServiceAccountAuth({
    client_email: serviceEmail,
    private_key: servicePrivateKey,
  });

  await doc.loadInfo();
  return doc;
};

const getMostRecentSignature = async (
  doc: GoogleSpreadsheet
): Promise<TransactionSignature | undefined> => {
  const sheet = await doc.sheetsByTitle["Last Transaction"];
  await sheet.loadCells();
  const lastTxStr = sheet.getCell(0, 0).formattedValue;
  if (!lastTxStr) return undefined;

  return lastTxStr as TransactionSignature;
};

const postToSheets = async (eventData: EventData[], doc: GoogleSpreadsheet) => {
  // Save last transaction
  const lastSignature = eventData[eventData.length - 1].event.signature;
  const lastTransactionSheet = await doc.sheetsByTitle["Last Transaction"];
  const cellA1 = lastTransactionSheet.getCell(0, 0);
  cellA1.value = lastSignature;
  await lastTransactionSheet.saveUpdatedCells();

  // Save each event type.
  const swapEvents = eventData
    .filter((e) => e.type === EventType.SwapEvent)
    .map((e) => e.event);
  if (swapEvents.length > 0) {
    const swapEventSheet = await doc.sheetsByTitle["SwapEvent"];
    await swapEventSheet.addRows(swapEvents);
  }

  const poolStates = eventData
    .filter((e) => e.type === EventType.PoolState)
    .map((e) => e.event);
  if (poolStates.length > 0) {
    const poolStateSheet = await doc.sheetsByTitle["PoolState"];
    await poolStateSheet.addRows(poolStates);
  }

  const liquidityDeltas = eventData
    .filter((e) => e.type === EventType.LiquidityDelta)
    .map((e) => e.event);
  if (liquidityDeltas.length > 0) {
    const liquidityDeltaSheet = await doc.sheetsByTitle["LiquidityDelta"];
    await liquidityDeltaSheet.addRows(liquidityDeltas);
  }
};

const main = async () => {
  let config = {
    inceptProgramID: new PublicKey(process.env.INCEPT_PROGRAM_ID!),
    documentId: process.env.DOCUMENT_ID!,
    serviceEmail: process.env.SERVICE_EMAIL!,
    servicePrivateKey: process.env.SERVICE_PRIVATE_KEY!.replace(/\\n/gm, '\n'),
  };

  let provider =
    process.env.DEVNET === "1"
      ? anchor.AnchorProvider.env()
      : anchor.AnchorProvider.local();

  const doc = await getDocument(
    config.documentId,
    config.serviceEmail,
    config.servicePrivateKey
  );

  let until = await getMostRecentSignature(doc);

  let events = await getEvents(config.inceptProgramID, provider, until);

  if (events.length > 0) {
    await postToSheets(events, doc);
  }
};

main();