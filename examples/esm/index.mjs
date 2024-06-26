import { ArNSNameEmitter, IO, ioDevnetProcessId } from '@ar.io/sdk';

(async () => {
  const programStart = Date.now();
  const arIO = IO.init({
    processId: 'agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA',
  });
  let idCount = 0;
  let idsChecked = 0;
  let percent = 0;
  let lastPercent = 0;
  let antsInError = 0;
  const address = 'ZjmB2vEUlHlJ7-rgJkYP09N5IzLPhJyStVrK5u9dDEo';
  const processEmitter = new ArNSNameEmitter({ contract: arIO });
  processEmitter.on('error', (e) => {
    antsInError++;
    console.error(e);
  });
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
  processEmitter.on('end', () => {
    console.log(
      'Complete',
      `${idsChecked} ids checked with ${antsInError} ants in error.`,
    );
    const programEnd = Date.now();
    console.log(`Program took ${programEnd - programStart}ms to run.`);
  });

  // kick off the retrieval of ants owned by a process
  processEmitter.fetchProcessesOwnedByWallet({ address });
})();
