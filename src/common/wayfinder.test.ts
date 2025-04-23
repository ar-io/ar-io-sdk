import axios from 'axios';
import assert from 'node:assert';
import { describe, it } from 'node:test';

import {
  AoARIORead,
  AoGatewayWithAddress,
  PaginationResult,
} from '../types/io.js';
import { Wayfinder, createWayfinderHttpClient } from './wayfinder.js';

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

  describe('getRedirectUrl', () => {
    it('should handle ar:// protocol with txid', async () => {
      const wayfinder = new Wayfinder({
        ario: stubbedArio,
        fetch: createWayfinderHttpClient({ httpClient: fetch }),
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
        fetch: createWayfinderHttpClient({ httpClient: fetch }),
      });
      const url = await wayfinder.getRedirectUrl({
        reference: 'ar:///info',
      });
      assert.strictEqual(url.toString(), 'https://arweave.net/info');
    });

    it('should handle ar:// protocol with an arns name', async () => {
      const wayfinder = new Wayfinder({
        ario: stubbedArio,
        fetch: createWayfinderHttpClient({ httpClient: fetch }),
      });
      const url = await wayfinder.getRedirectUrl({
        reference: 'ar://name',
      });
      assert.strictEqual(url.toString(), 'https://name.arweave.net/'); // TODO: confirm trailing slash is correct and add tests for query params
    });

    it('should throw error for invalid protocol', async () => {
      const wayfinder = new Wayfinder({
        ario: stubbedArio,
        fetch: createWayfinderHttpClient({ httpClient: fetch }),
      });
      assert.rejects(
        wayfinder.getRedirectUrl({
          reference: 'http://arweave.net',
        }),
        new Error('Invalid reference, must start with ar://'),
      );
    });

    it('should throw error for invalid reference format', async () => {
      const wayfinder = new Wayfinder({
        ario: stubbedArio,
        fetch: createWayfinderHttpClient({ httpClient: fetch }),
      });
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
      const wayfinder = new Wayfinder({
        ario: stubbedArio,
        fetch: createWayfinderHttpClient({ httpClient: fetch }),
      });
      const gateway = await wayfinder.strategy.getTargetGateway();
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
        fetch: createWayfinderHttpClient({ httpClient: fetch }),
      });
      assert.rejects(
        wayfinder.strategy.getTargetGateway(),
        new Error('No target gateway found'),
      );
    });
  });

  // the http wrapper should work as expected
  describe('http wrapper', () => {
    describe('fetch', () => {
      it('should fetch the data using the selected gateway', async () => {
        const wayfinder = new Wayfinder({
          ario: stubbedArio,
          fetch: createWayfinderHttpClient({ httpClient: fetch }),
        });
        const nativeFetch = await fetch('https://ao.arweave.net');
        const response = await wayfinder.fetch('ar://ao');
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeFetch.status);
        // assert the arns headers are the same
        const arnsHeaders = Array.from(response.headers.entries()).filter(
          ([key]) => key.startsWith('x-arns-'),
        );
        const nativeFetchHeaders = Array.from(
          nativeFetch.headers.entries(),
        ).filter(([key]) => key.startsWith('x-arns-'));
        assert.deepStrictEqual(arnsHeaders, nativeFetchHeaders);
        assert.deepStrictEqual(await response.text(), await nativeFetch.text());
      });
      it('should route a non-ar:// url as a normal fetch', async () => {
        const wayfinder = new Wayfinder({
          ario: stubbedArio,
          fetch: createWayfinderHttpClient({ httpClient: fetch }),
        });
        const nativeFetch = await fetch('https://arweave.net/', {
          method: 'HEAD',
        });
        const response = await wayfinder.fetch('https://arweave.net/', {
          method: 'HEAD',
        });
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeFetch.status);
        // TODO: ensure the headers are the same excluding unique headers
        assert.deepStrictEqual(await response.text(), await nativeFetch.text());
      });

      for (const api of ['/info', '/metrics', '/block/current']) {
        it(`supports a native arweave node apis ${api}`, async () => {
          const wayfinder = new Wayfinder({
            ario: stubbedArio,
            fetch: createWayfinderHttpClient({ httpClient: fetch }),
          });
          const nativeFetch = await fetch(`https://arweave.net${api}`);
          const response = await wayfinder.fetch(`ar:///${api}`);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeFetch.status);
          // TODO: ensure the headers are the same excluding unique headers
          assert.deepStrictEqual(
            await response.text(),
            await nativeFetch.text(),
          );
        });
      }

      for (const api of ['/ar-io/info', '/ar-io/__gateway_metrics']) {
        it(`supports a native ario node gateway apis ${api}`, async () => {
          const wayfinder = new Wayfinder({
            ario: stubbedArio,
            fetch: createWayfinderHttpClient({ httpClient: fetch }),
          });
          const nativeFetch = await fetch(`https://arweave.net${api}`);
          const response = await wayfinder.fetch(`ar:///${api}`);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeFetch.status);
          // TODO: ensure the headers are the same excluding unique headers
          assert.deepStrictEqual(
            await response.text(),
            await nativeFetch.text(),
          );
        });
      }

      it('returns the error from the target gateway if the route is not found', async () => {
        const wayfinder = new Wayfinder({
          ario: stubbedArio,
          fetch: createWayfinderHttpClient({ httpClient: fetch }),
        });
        const nativeFetch = await fetch('https://arweave.net/not-found');
        const response = await wayfinder.fetch('https://arweave.net/not-found');
        assert.strictEqual(response.status, nativeFetch.status);
        assert.strictEqual(response.statusText, nativeFetch.statusText);
        assert.deepStrictEqual(await response.text(), await nativeFetch.text());
      });
    });

    describe('axios', () => {
      it('should fetch the data using axios against the target gateway', async () => {
        const wayfinder = new Wayfinder({
          ario: stubbedArio,
          fetch: createWayfinderHttpClient({ httpClient: axios }),
        });
        const nativeAxios = await axios.get('https://ao.arweave.net');
        const response = await wayfinder.fetch('ar://ao');
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeAxios.status);
        // assert the arns headers are the same
        const arnsHeaders = Object.entries(response.headers).filter(([key]) =>
          key.startsWith('x-arns-'),
        );
        const nativeAxiosHeaders = Object.entries(nativeAxios.headers).filter(
          ([key]) => key.startsWith('x-arns-'),
        );
        assert.deepStrictEqual(arnsHeaders, nativeAxiosHeaders);
        assert.deepStrictEqual(response.data, nativeAxios.data);
      });

      it('should route a non-ar:// url as a normal axios', async () => {
        const wayfinder = new Wayfinder({
          ario: stubbedArio,
          fetch: createWayfinderHttpClient({ httpClient: axios }),
        });
        const nativeAxios = await axios.get('https://arweave.net/');
        const response = await wayfinder.fetch('https://arweave.net/');
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeAxios.status);
        assert.deepStrictEqual(response.data, nativeAxios.data);
        // TODO: ensure the headers are the same excluding unique headers
      });

      it('should return the error from the target gateway if the route is not found', async () => {
        const axiosInstance = axios.create({
          validateStatus: () => true, // don't throw so we can compare axios result with wrapped axios result
        });
        const wayfinder = new Wayfinder({
          ario: stubbedArio,
          fetch: createWayfinderHttpClient({
            httpClient: axiosInstance,
          }),
        });
        const nativeAxios = await axiosInstance.get(
          'https://arweave.net/not-found',
        );
        const response = await wayfinder.fetch('https://arweave.net/not-found');
        assert.strictEqual(response.status, nativeAxios.status);
        assert.strictEqual(response.data, nativeAxios.data);
      });
    });
  });
});
