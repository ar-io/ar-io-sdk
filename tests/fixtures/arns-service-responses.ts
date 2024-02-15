import { Source, SourceType } from 'warp-contracts';

import { EvaluatedContractState } from '../../src/types.js';

export const ArnsStateResponse: EvaluatedContractState<Record<string, any>> = {
  contractTxId: 'bLAgYxAdX2Ry-nt6aH2ixgvJXbpsEYm28NgJgyqfs-U',
  state: {
    ticker: 'ARNS-TEST',
    name: 'Arweave Name System Test',
    version: '0.0.18',
    owner: '',
    evolve: null,
    records: {},
    balances: {},
    vaults: {},
    reserved: {},
    fees: {},
    auctions: {},
    settings: {},
    gateways: {},
    observations: {},
    demandFactoring: {
      periodZeroBlockHeight: 0,
      currentPeriod: 0,
      trailingPeriodPurchases: [0, 0, 0, 0, 0, 0, 0],
      trailingPeriodRevenues: [0, 0, 0, 0, 0, 0, 0],
      purchasesThisPeriod: 0,
      demandFactor: 1,
      revenueThisPeriod: 0,
      consecutivePeriodsWithMinDemandFactor: 0,
    },
  },
  sortKey:
    '000001301946,0000000000000,d2efe5278648460ed160e1d8a28fb86ab686e36cf14a3321d0a2b10c6851ea99',
  evaluationOptions: {
    sourceType: 'arweave' as SourceType,
    internalWrites: true,
    useKVStorage: true,
    remoteStateSyncEnabled: true,
    waitForConfirmation: true,
    maxInteractionEvaluationTimeSeconds: 0,
    throwOnInternalWriteError: true,
  } as any,
  validity: {},
  errorMessages: {},
};
