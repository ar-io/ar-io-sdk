import {
  ArNSNameEmitter,
  IO,
  getANTProcessesOwnedByWallet,
  ioDevnetProcessId,
} from '@ar.io/sdk';

(async () => {
  const arIO = IO.init({
    processId: ioDevnetProcessId,
  });
  let idCount = 0;
  let idsChecked = 0;
  let percent = 0;
  let lastPercent = 0;
  const address = 'ZjmB2vEUlHlJ7-rgJkYP09N5IzLPhJyStVrK5u9dDEo';
  const processEmitter = new ArNSNameEmitter();
  processEmitter.on('error', console.error);
  processEmitter.on('process', (processId, antState) =>
    console.log(
      `Discovered process owned by wallet called "${antState.Name}": `,
      processId,
      Date.now(),
    ),
  );
  processEmitter.on('progress', (idIndex, totalIds) => {
    idCount = totalIds;
    idsChecked++;
    percent = Math.floor((idsChecked / idCount) * 100);
    if (percent !== lastPercent) {
      lastPercent = percent;
      console.log(`Progress: ${percent}%`);
    }
  });
  processEmitter.on('complete', () => {
    console.log('Complete');
  });

  // kick off the retrieval of ants owned by a process
  processEmitter
    .fetchProcessesOwnedByWallet({ address })
    .then(() => console.log(`Fetched ${idCount} process ids`));
})();
