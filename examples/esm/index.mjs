import { ArNSNameEmitter } from '@ar.io/sdk';

(async () => {
  const address = 'ZjmB2vEUlHlJ7-rgJkYP09N5IzLPhJyStVrK5u9dDEo';
  const processEmitter = new ArNSNameEmitter();
  processEmitter.on('error', console.error);
  processEmitter.on('process', (processId) =>
    console.log('Discovered process owned by wallet: ', processId, Date.now()),
  );
  processEmitter.on('done', () => console.log('Finished fetching processes'));
  // kick off the retrieval of ants owned by a process
  processEmitter.fetchProcessesOwnedByWallet({ address }).then(() => {
    console.log('Finished fetching processes');
  });
})();
