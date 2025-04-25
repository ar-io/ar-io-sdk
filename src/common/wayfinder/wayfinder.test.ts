import axios from 'axios';
import got from 'got';
import assert from 'node:assert';
import { buffer } from 'node:stream/consumers';
import { before, describe, it } from 'node:test';

import { AoGatewayWithAddress } from '../../types/io.js';
import { GatewaysProvider } from './gateways.js';
import { RandomGatewayRouter } from './routers/random.js';
import { Wayfinder } from './wayfinder.js';

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
const stubbedGatewaysProvider: GatewaysProvider = {
  getGateways: async () => [stubbedGateway],
} as unknown as GatewaysProvider;

describe('Wayfinder', () => {
  describe('http wrapper', () => {
    describe('fetch', () => {
      let wayfinder: Wayfinder<typeof fetch>;
      before(() => {
        wayfinder = new Wayfinder({
          httpClient: fetch,
          router: new RandomGatewayRouter({
            gatewaysProvider: stubbedGatewaysProvider,
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

      it('supports a post request to graphql', async () => {
        const response = await wayfinder.request('ar:///graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
                query {
                  transactions(
                    ids: ["xf958qhCNGfDme1FtoiD6DtMfDENDbtxZpjOM_1tsMM"]
                  ) {
                    edges {
                      cursor
                      node {
                        id
                        tags {
                          name
                          value
                        }
                        block {
                          height
                          timestamp
                        }
                      }
                    }
                    pageInfo {
                      hasNextPage
                    }
                  }
                }
            `,
          }),
        });
        assert.strictEqual(response.status, 200);
      });

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
          router: new RandomGatewayRouter({
            gatewaysProvider: stubbedGatewaysProvider,
          }),
        });
      });
      it('should fetch the data using axios default function against the target gateway', async () => {
        const [nativeAxios, response] = await Promise.all([
          axios('https://ao.arweave.net'),
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

      it('should fetch the data using the axios.get method against the target gateway', async () => {
        const [nativeAxios, response] = await Promise.all([
          axios.get('https://ao.arweave.net'),
          wayfinder.request.get('ar://ao'),
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

      it('should route a non-ar:// url as a normal axios request', async () => {
        const [nativeAxios, response] = await Promise.all([
          axios('https://arweave.net/'),
          wayfinder.request('https://arweave.net/'),
        ]);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeAxios.status);
        assert.deepStrictEqual(response.data, nativeAxios.data);
        // TODO: ensure the headers are the same excluding unique headers
      });

      for (const api of ['/info', '/metrics', '/block/current']) {
        it(`supports native arweave node apis ${api}`, async () => {
          const [nativeAxios, response] = await Promise.all([
            axios(`https://arweave.net${api}`),
            wayfinder.request(`ar:///${api}`),
          ]);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeAxios.status);
          // TODO: ensure the headers are the same excluding unique headers
          assert.deepStrictEqual(response.data, nativeAxios.data);
        });
      }

      for (const api of ['/ar-io/info', '/ar-io/__gateway_metrics']) {
        it(`supports native ario node gateway apis ${api}`, async () => {
          const [nativeAxios, response] = await Promise.all([
            axios(`https://arweave.net${api}`),
            wayfinder.request(`ar:///${api}`),
          ]);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeAxios.status);
          // TODO: ensure the headers are the same excluding unique headers
          assert.deepStrictEqual(response.data, nativeAxios.data);
        });
      }

      it('should return the error from the target gateway if the route is not found', async () => {
        const axiosInstance = axios.create({
          validateStatus: () => true, // don't throw so we can compare axios result with wrapped axios result
        });
        const wayfinder = new Wayfinder({
          httpClient: axiosInstance,
          router: new RandomGatewayRouter({
            gatewaysProvider: stubbedGatewaysProvider,
          }),
        });
        const [nativeAxios, response] = await Promise.all([
          axiosInstance('https://arweave.net/not-found'),
          wayfinder.request('https://arweave.net/not-found'),
        ]);
        assert.strictEqual(response.status, nativeAxios.status);
        assert.strictEqual(response.data, nativeAxios.data);
      });
    });

    describe('got', () => {
      let wayfinder: Wayfinder<typeof got>;
      before(() => {
        wayfinder = new Wayfinder({
          httpClient: got,
          router: new RandomGatewayRouter({
            gatewaysProvider: stubbedGatewaysProvider,
          }),
        });
      });

      it('should fetch the data using the got default function against the target gateway', async () => {
        const [nativeGot, response] = await Promise.all([
          got('https://ao.arweave.net'),
          wayfinder.request('ar://ao'),
        ]);
        assert.strictEqual(response.statusCode, 200);
        assert.strictEqual(response.statusCode, nativeGot.statusCode);
        assert.deepStrictEqual(response.body, nativeGot.body);
      });

      it('should stream the data using got.stream against the selected target gateway', async () => {
        const nativeBuffer = await buffer(
          await got.stream('https://ao.arweave.net', { decompress: false }),
        );
        const wayfinderBuffer = await buffer(
          await wayfinder.request.stream('ar://ao', { decompress: false }),
        );
        assert.deepStrictEqual(wayfinderBuffer, nativeBuffer);
      });
    });
  });
});
