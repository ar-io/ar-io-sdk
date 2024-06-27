import { ArNSNameEmitter, IO, ioDevnetProcessId } from '@ar.io/sdk';

(async () => {
  const programStart = Date.now();
  const arIO = IO.init({
    processId: 'agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA',
  });

  let antsInError = 0;
  const address = 'ZjmB2vEUlHlJ7-rgJkYP09N5IzLPhJyStVrK5u9dDEo';
  const processEmitter = new ArNSNameEmitter({ contract: arIO });
  processEmitter.on('error', (e) => {
    antsInError++;
    console.error(e);
  });
  processEmitter.on('process', (processId, antState) =>
    console.log(
      `Discovered process owned by wallet called "${antState.names}": `,
      processId,
      Date.now(),
    ),
  );
  processEmitter.on('end', (res) => {
    console.log(
      'Complete',
      `${Object.keys(res).length} ids checked with ${antsInError} ants in error.`,
    );
    console.log(res);
    const programEnd = Date.now();
    console.log(`Program took ${programEnd - programStart}ms to run.`);
  });

  // kick off the retrieval of ants owned by a process
  processEmitter.fetchProcessesOwnedByWallet({ address });
})();
