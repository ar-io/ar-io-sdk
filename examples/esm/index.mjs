import { ANT, ARIO } from "@ar.io/sdk";
import { createSolanaRpc } from "@solana/kit";

(async () => {
  const rpc = createSolanaRpc("https://api.mainnet-beta.solana.com");
  const ario = ARIO.init({ rpc });

  const contractInfo = await ario.getInfo();
  const testnetGateways = await ario.getGateways();
  const ardriveRecord = await ario.getArNSRecord({ name: "ardrive" });
  const partialRecords = await ario.getArNSRecords();
  const epoch = await ario.getCurrentEpoch();
  const observations = await ario.getObservations({ epochIndex: 0 });
  const distributions = await ario.getDistributions({ epochIndex: 0 });
  const buyRecordCost = await ario.getTokenCost({
    intent: "Buy-Name",
    type: "lease",
    name: "ar-io-dapp-record",
    years: 1,
  });
  const extendLeaseCost = await ario.getTokenCost({
    intent: "Extend-Lease",
    name: "ardrive",
    years: 1,
  });
  const increaseUndernameCost = await ario.getTokenCost({
    intent: "Increase-Undername-Limit",
    name: "ao",
    quantity: 1,
  });

  console.dir(
    {
      contractInfo,
      testnetGateways,
      ardriveRecord,
      epoch,
      observations,
      distributions,
      records: partialRecords.items,
      buyRecordCost,
      extendLeaseCost,
      increaseUndernameCost,
    },
    { depth: 2 },
  );

  // Look up an ANT (Metaplex Core asset on Solana) by its mint pubkey.
  // Replace with a real on-chain ANT mint to exercise the read surface.
  if (ardriveRecord?.processId) {
    const ant = await ANT.init({ processId: ardriveRecord.processId, rpc });
    const antRecords = await ant.getRecords();
    const rootRecord = await ant.getRecord({ undername: "@" });
    const owner = await ant.getOwner();
    const info = await ant.getInfo();
    console.dir(
      {
        antProcessId: ardriveRecord.processId,
        antRecords,
        rootRecord,
        info,
        owner,
      },
      { depth: 2 },
    );
  }
})();
