import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { AoGatewayWithAddress } from '../../../types/io.js';
import { PriorityGatewayRouter } from './priority.js';

describe('PriorityRouter', () => {
  const mockGateways: AoGatewayWithAddress[] = [
    {
      settings: {
        fqdn: 'gateway1.net',
        port: 443,
        protocol: 'https',
        allowDelegatedStaking: false,
        delegateRewardShareRatio: 0.5,
        allowedDelegates: [],
        minDelegatedStake: 0,
        autoStake: false,
        properties: '',
        label: '',
        note: '',
      },
      gatewayAddress: 'addr1',
      observerAddress: 'addr1',
      totalDelegatedStake: 1000,
      startTimestamp: 0,
      endTimestamp: 0,
      operatorStake: 100,
      status: 'joined',
      weights: {
        normalizedCompositeWeight: 0.5,
        stakeWeight: 0.5,
        tenureWeight: 0.5,
        gatewayPerformanceRatio: 0.5,
        observerPerformanceRatio: 0.5,
        compositeWeight: 0.5,
        gatewayRewardRatioWeight: 0.5,
        observerRewardRatioWeight: 0.5,
      },
      stats: {
        passedConsecutiveEpochs: 10,
        failedConsecutiveEpochs: 5,
        totalEpochCount: 15,
        passedEpochCount: 10,
        failedEpochCount: 5,
        observedEpochCount: 15,
        prescribedEpochCount: 20,
      },
    },
    {
      settings: {
        fqdn: 'gateway1.net',
        port: 443,
        protocol: 'https',
        allowDelegatedStaking: false,
        delegateRewardShareRatio: 0.5,
        allowedDelegates: [],
        minDelegatedStake: 0,
        autoStake: false,
        properties: '',
        label: '',
        note: '',
      },
      gatewayAddress: 'addr1',
      observerAddress: 'addr1',
      totalDelegatedStake: 2000,
      startTimestamp: 0,
      endTimestamp: 0,
      operatorStake: 2000,
      status: 'joined',
      weights: {
        normalizedCompositeWeight: 0.5,
        stakeWeight: 0.5,
        tenureWeight: 0.5,
        gatewayPerformanceRatio: 0.5,
        observerPerformanceRatio: 0.5,
        compositeWeight: 0.5,
        gatewayRewardRatioWeight: 0.5,
        observerRewardRatioWeight: 0.5,
      },
      stats: {
        passedConsecutiveEpochs: 10,
        failedConsecutiveEpochs: 5,
        totalEpochCount: 15,
        passedEpochCount: 10,
        failedEpochCount: 5,
        observedEpochCount: 15,
        prescribedEpochCount: 20,
      },
    },
    {
      settings: {
        fqdn: 'gateway2.net',
        port: 443,
        protocol: 'https',
        allowDelegatedStaking: false,
        delegateRewardShareRatio: 0.5,
        allowedDelegates: [],
        minDelegatedStake: 0,
        autoStake: false,
        properties: '',
        label: '',
        note: '',
      },
      gatewayAddress: 'addr2',
      observerAddress: 'addr2',
      totalDelegatedStake: 0,
      startTimestamp: 0,
      endTimestamp: 0,
      operatorStake: 0,
      status: 'leaving',
      weights: {
        normalizedCompositeWeight: 0.5,
        stakeWeight: 0.5,
        tenureWeight: 0.5,
        gatewayPerformanceRatio: 0.5,
        observerPerformanceRatio: 0.5,
        compositeWeight: 0.5,
        gatewayRewardRatioWeight: 0.5,
        observerRewardRatioWeight: 0.5,
      },
      stats: {
        passedConsecutiveEpochs: 10,
        failedConsecutiveEpochs: 5,
        totalEpochCount: 15,
        passedEpochCount: 10,
        failedEpochCount: 5,
        observedEpochCount: 15,
        prescribedEpochCount: 20,
      },
    },
  ];

  const mockGatewaysProvider = {
    getGateways: async () => mockGateways,
  };

  it('should prioritize gateway with highest success rate when using successRate weight', async () => {
    const router = new PriorityGatewayRouter({
      gatewaysProvider: mockGatewaysProvider,
      sortBy: 'totalDelegatedStake',
      sortOrder: 'desc',
      limit: 1,
    });

    const result = await router.getTargetGateway();
    assert.deepStrictEqual(result, new URL('http://gateway1.net'));
  });

  it('should prioritize gateway with lowest latency when using latency weight', async () => {
    const router = new PriorityGatewayRouter({
      gatewaysProvider: mockGatewaysProvider,
      sortBy: 'operatorStake',
      sortOrder: 'desc',
      limit: 1,
    });

    const result = await router.getTargetGateway();
    assert.deepStrictEqual(result, new URL('http://gateway2.net'));
  });
});
