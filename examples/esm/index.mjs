import { ArweaveSigner, IO, ioDevnetProcessId } from '@ar.io/sdk';
import fs from 'fs';

(async () => {
  const wallet = JSON.parse(fs.readFileSync('./wallet.json', 'utf8'));
  const signer = new ArweaveSigner(wallet);
  const arIO = IO.init({
    processId: ioDevnetProcessId,
    signer,
  });
  // devnet gateways
  const testnetGateways = await arIO.getGateways();
  const protocolBalance = await arIO.getBalance({
    address: ioDevnetProcessId,
  });
  const ardriveRecord = await arIO.getArNSRecord({ domain: 'ardrive' });
  const allRecords = await arIO.getArNSRecords();
  console.dir(
    {
      testnetGateways,
      ardriveRecord,
      protocolBalance,
      arnsStats: {
        'registered domains': Object.keys(allRecords).length,
        ardrive: allRecords.ardrive,
      },
    },
    { depth: 2 },
  );
})();
