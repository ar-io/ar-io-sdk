import axios from 'axios';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';

import {
  AoARIORead,
  AoGatewayWithAddress,
  PaginationResult,
} from '../types/io.js';
import { RandomGatewayStrategy, Wayfinder } from './wayfinder.js';

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

  describe('http wrapper', () => {
    describe('fetch', () => {
      let wayfinder: Wayfinder<typeof fetch>;
      before(() => {
        wayfinder = new Wayfinder({
          httpClient: fetch,
          strategy: new RandomGatewayStrategy({
            ario: stubbedArio,
          }),
        });
      });
      it('should fetch the data using the selected gateway', async () => {
        const nativeFetch = await fetch('https://ao.arweave.net');
        const response = await wayfinder.request('ar://ao');
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
        const [nativeFetch, response] = await Promise.all([
          fetch('https://arweave.net/', {
            method: 'HEAD',
          }),
          wayfinder.request('https://arweave.net/', {
            method: 'HEAD',
          }),
        ]);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeFetch.status);
        // TODO: ensure the headers are the same excluding unique headers
        assert.deepStrictEqual(await response.text(), await nativeFetch.text());
      });

      for (const api of ['/info', '/metrics', '/block/current']) {
        it(`supports native arweave node apis ${api}`, async () => {
          const [nativeFetch, response] = await Promise.all([
            fetch(`https://arweave.net${api}`),
            wayfinder.request(`ar:///${api}`),
          ]);
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
        it(`supports native ario node gateway apis ${api}`, async () => {
          const [nativeFetch, response] = await Promise.all([
            fetch(`https://arweave.net${api}`),
            wayfinder.request(`ar:///${api}`),
          ]);
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
        const [nativeFetch, response] = await Promise.all([
          fetch('https://arweave.net/not-found'),
          wayfinder.request('https://arweave.net/not-found'),
        ]);
        assert.strictEqual(response.status, nativeFetch.status);
        assert.strictEqual(response.statusText, nativeFetch.statusText);
        assert.deepStrictEqual(await response.text(), await nativeFetch.text());
      });
    });

    describe('axios', () => {
      let wayfinder: Wayfinder<typeof axios>;
      before(() => {
        wayfinder = new Wayfinder({
          httpClient: axios,
          strategy: new RandomGatewayStrategy({ ario: stubbedArio }),
        });
      });
      it('should fetch the data using axios against the target gateway', async () => {
        const [nativeAxios, response] = await Promise.all([
          axios.get('https://ao.arweave.net'),
          wayfinder.request('ar://ao'),
        ]);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeAxios.status);
        // assert the arns headers are the same
        const arnsHeaders = Object.entries(response.headers)
          .sort()
          .filter(([key]) => key.startsWith('x-arns-'));
        const nativeAxiosHeaders = Object.entries(nativeAxios.headers).filter(
          ([key]) => key.startsWith('x-arns-'),
        );
        assert.deepStrictEqual(arnsHeaders.sort(), nativeAxiosHeaders.sort());
        assert.deepStrictEqual(response.data, nativeAxios.data);
      });

      it('should route a non-ar:// url as a normal axios', async () => {
        const [nativeAxios, response] = await Promise.all([
          axios.get('https://arweave.net/'),
          wayfinder.request('https://arweave.net/'),
        ]);
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
          httpClient: axiosInstance,
          strategy: new RandomGatewayStrategy({
            ario: stubbedArio,
          }),
        });
        const [nativeAxios, response] = await Promise.all([
          axiosInstance.get('https://arweave.net/not-found'),
          wayfinder.request('https://arweave.net/not-found'),
        ]);
        assert.strictEqual(response.status, nativeAxios.status);
        assert.strictEqual(response.data, nativeAxios.data);
      });
    });
  });
});
