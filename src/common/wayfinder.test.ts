import axios from 'axios';
import assert from 'node:assert';
import { describe, it } from 'node:test';

import {
  AoARIORead,
  AoGatewayWithAddress,
  PaginationResult,
} from '../types/io.js';
import { ArNSNameResolver, Wayfinder } from './wayfinder.js';

describe('Wayfinder', () => {
  const stubbedGateway: AoGatewayWithAddress = {
    status: 'joined',
    gatewayAddress: 'arweave',
    operatorStake: 1000,
    totalDelegatedStake: 1000,
    startTimestamp: 1000,
    settings: {
      protocol: 'https',
      fqdn: 'arweave.net',
      port: 443,
    },
  } as unknown as AoGatewayWithAddress;
  const stubbedArio: AoARIORead = {
    getGateways: async () =>
      ({
        items: [stubbedGateway],
        cursor: null,
        limit: 1,
        totalItems: 1,
        sortOrder: 'desc',
        sortBy: 'operatorStake',
        hasMore: false,
      }) as unknown as PaginationResult<AoGatewayWithAddress>,
    getGateway: async ({ address }: { address: string }) =>
      address === stubbedGateway.gatewayAddress ? stubbedGateway : null,
  } as unknown as AoARIORead;
  const stubbedResolver = {
    resolve: async ({ name }: { name: string }) => ({
      txId: 'tx-id',
      processId: 'process-id',
      owner: 'owner',
      name: name,
      ttlSeconds: 1000,
      undernameLimit: 1000,
      undernameIndex: 1,
    }),
  } as unknown as ArNSNameResolver;

  describe('getRedirectUrl', () => {
    it('should handle ar:// protocol with txid', async () => {
      const wayfinder = new Wayfinder({
        ario: stubbedArio,
        resolver: stubbedResolver,
      });
      const txId = '0'.repeat(43);
      const url = await wayfinder.getRedirectUrl({
        reference: `ar://${txId}`,
      });
      assert.strictEqual(url.toString(), `https://arweave.net/${txId}`);
    });

    it('should handle ar:// protocol with a gateway api', async () => {
      const wayfinder = new Wayfinder({
        ario: stubbedArio,
        resolver: stubbedResolver,
      });
      const url = await wayfinder.getRedirectUrl({
        reference: 'ar:///info',
      });
      assert.strictEqual(url.toString(), 'https://arweave.net/info');
    });

    it('should handle ar:// protocol with an arns name', async () => {
      const wayfinder = new Wayfinder({
        ario: stubbedArio,
        resolver: stubbedResolver,
      });
      const url = await wayfinder.getRedirectUrl({
        reference: 'ar://name',
      });
      assert.strictEqual(url.toString(), 'https://name.arweave.net/'); // TODO: confirm trailing slash is correct and add tests for query params
    });

    it('should throw error for invalid protocol', async () => {
      const wayfinder = new Wayfinder({ ario: stubbedArio });
      assert.rejects(
        wayfinder.getRedirectUrl({
          reference: 'http://arweave.net',
        }),
        new Error('Invalid reference, must start with ar://'),
      );
    });

    it('should throw error for invalid reference format', async () => {
      const wayfinder = new Wayfinder({ ario: stubbedArio });
      assert.rejects(
        wayfinder.getRedirectUrl({
          reference: 'ar://invalid!reference',
        }),
        new Error(
          'Invalid reference. Must be of the form ar://<txid> or ar://<name> or ar:///<gateway-api>',
        ),
      );
    });
  });

  describe('getTargetGateway', () => {
    it('should return the target gateway', async () => {
      const wayfinder = new Wayfinder({ ario: stubbedArio });
      const gateway = await wayfinder.getTargetGateway();
      assert.strictEqual(gateway.toString(), 'https://arweave.net/');
    });

    it('should throw error if no gateway is found', async () => {
      const wayfinder = new Wayfinder({
        ario: {
          getGateways: async () =>
            ({
              items: [],
              cursor: null,
              limit: 1,
              totalItems: 0,
              sortOrder: 'desc',
              sortBy: 'operatorStake',
              hasMore: false,
            }) as unknown as PaginationResult<AoGatewayWithAddress>,
        } as unknown as AoARIORead,
      });
      assert.rejects(
        wayfinder.getTargetGateway(),
        new Error('No target gateway found'),
      );
    });
  });

  // the http wrapper should work as expected
  describe('http wrapper', () => {
    describe('fetch', () => {
      it('should fetch the data using the selected gateway', async () => {
        const wayfinder = new Wayfinder({ ario: stubbedArio, http: fetch });
        const response = await wayfinder.http('ar://ao');
        assert.strictEqual(response.status, 200);
      });

      it('should route a non-ar:// url as a normal fetch', async () => {
        const wayfinder = new Wayfinder({ ario: stubbedArio, http: fetch });
        const response = await wayfinder.http('https://arweave.net/');
        assert.strictEqual(response.status, 200);
      });
    });

    describe('axios', () => {
      it('should fetch the data using the selected gateway', async () => {
        const wayfinder = new Wayfinder({ ario: stubbedArio, http: axios });
        const response = await wayfinder.http('ar://ao');
        assert.strictEqual(response.status, 200);
      });

      it('should route a non-ar:// url as a normal fetch', async () => {
        const wayfinder = new Wayfinder({ ario: stubbedArio, http: axios });
        const response = await wayfinder.http('https://arweave.net/');
        assert.strictEqual(response.status, 200);
      });
    });
  });
});
