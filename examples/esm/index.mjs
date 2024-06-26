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

  const address = 'ZjmB2vEUlHlJ7-rgJkYP09N5IzLPhJyStVrK5u9dDEo';
  const processEmitter = new ArNSNameEmitter();
  processEmitter.on('error', console.error);
  processEmitter.on('process', (processId) =>
    console.log('Discovered process owned by wallet: ', processId, Date.now()),
  );
  // kick off the retrieval of ants owned by a process
  processEmitter.fetchProcessesOwnedByWallet({ address });
})();
