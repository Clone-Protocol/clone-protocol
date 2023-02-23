// https://stackoverflow.com/questions/69245982/import-phantom-wallet-private-key-into-solana-cli
const bs58 = require("bs58");
const fs = require("fs");

const main = () => {
  const privateKey = "A5LctLe2KR5Fbsa92d9gabNnAWs8JnuUoAroXYbGXArHaVez8SxnDLJyXmBf4Jdsi34LTPKRPN9geE7Q1pwoA5u";
  const fileOut = "key.json";
  const b = bs58.decode(privateKey);
  const j = new Uint8Array(
    b.buffer,
    b.byteOffset,
    b.byteLength / Uint8Array.BYTES_PER_ELEMENT
  );
  fs.writeFileSync(fileOut, `[${j}]`);
};

main();
