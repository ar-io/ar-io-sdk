import { ArweaveSigner, IO, ioDevnetProcessId } from '@ar.io/sdk';
import fs from 'fs';

(async () => {
  const wallet = JSON.parse(fs.readFileSync('./wallet.json', 'utf8'));
  const signer = new ArweaveSigner(wallet);
  const arIO = IO.init({
    processId: 'GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc',
    signer,
  });
  // // testnet gateways
  // const testnetGateways = await arIO.getGateways();
  // const protocolBalance = await arIO.getBalance({
  //   address: ioDevnetProcessId,
  // });
  // const ardriveRecord = await arIO.getArNSRecord({ domain: 'ardrive' });
  // const allRecords = await arIO.getArNSRecords();
  const transfer = await arIO.transfer({
    target: 'ZjmB2vEUlHlJ7-rgJkYP09N5IzLPhJyStVrK5u9dDEo',
    qty: 1000000000000,
  });

  console.log(transfer);
  // console.dir(
  //   {
  //     testnetGateways,
  //     ardriveRecord,
  //     protocolBalance,
  //     arnsStats: {
  //       'registered domains': Object.keys(allRecords).length,
  //       ardrive: allRecords.ardrive,
  //     },
  //   },
  //   { depth: 2 },
  // );
})();
