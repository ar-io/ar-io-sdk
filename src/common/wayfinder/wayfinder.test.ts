import axios from 'axios';
import got from 'got';
import assert from 'node:assert';
import { buffer } from 'node:stream/consumers';
import { before, describe, it } from 'node:test';

import { Logger } from '../../common/logger.js';
import { GatewaysProvider } from './gateways.js';
import { RandomGatewayRouter } from './routers/random.js';
import { Wayfinder } from './wayfinder.js';

const gatewayUrl = 'permagate.io';
const stubbedGatewaysProvider: GatewaysProvider = {
  getGateways: async () => [new URL(`https://${gatewayUrl}`)],
} as unknown as GatewaysProvider;

Logger.default.setLogLevel('debug');

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
        const nativeFetch = await fetch(`https://ao.${gatewayUrl}`);
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
      });

      it('should fetch a tx id using the selected gateway', async () => {
        const nativeFetch = await fetch(
          `https://${gatewayUrl}/KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A`,
          // follow redirects
          { redirect: 'follow' },
        );
        const response = await wayfinder.request(
          'ar://KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A',
          { redirect: 'follow' },
        );
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeFetch.status);
      });

      it('should route a non-ar:// url as a normal fetch', async () => {
        const [nativeFetch, response] = await Promise.all([
          fetch(`https://${gatewayUrl}/`, {
            method: 'HEAD',
          }),
          wayfinder.request(`https://${gatewayUrl}/`, {
            method: 'HEAD',
          }),
        ]);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeFetch.status);
        // TODO: ensure the headers are the same excluding unique headers
      });

      for (const api of ['/info', '/block/current']) {
        it(`supports native arweave node apis ${api}`, async () => {
          const [nativeFetch, response] = await Promise.all([
            fetch(`https://${gatewayUrl}${api}`),
            wayfinder.request(`ar://${api}`),
          ]);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeFetch.status);
          // TODO: ensure the headers are the same excluding unique headers
        });
      }

      for (const api of ['/ar-io/info']) {
        it(`supports native ario node gateway apis ${api}`, async () => {
          const [nativeFetch, response] = await Promise.all([
            fetch(`https://${gatewayUrl}${api}`),
            wayfinder.request(`ar:///${api}`),
          ]);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeFetch.status);
          // TODO: ensure the headers are the same excluding unique headers
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
          fetch(`https://${gatewayUrl}/ar-io/not-found`),
          wayfinder.request('ar:///not-found'),
        ]);
        assert.strictEqual(response.status, nativeFetch.status);
        assert.strictEqual(response.statusText, nativeFetch.statusText);
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
          axios(`https://ao.${gatewayUrl}`),
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
      });

      it('should fetch the data using the axios.get method against the target gateway', async () => {
        const [nativeAxios, response] = await Promise.all([
          axios.get(`https://ao.${gatewayUrl}`),
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
      });

      it('should route a non-ar:// url as a normal axios request', async () => {
        const [nativeAxios, response] = await Promise.all([
          axios(`https://${gatewayUrl}/`),
          wayfinder.request(`https://${gatewayUrl}/`),
        ]);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeAxios.status);
        // TODO: ensure the headers are the same excluding unique headers
      });

      for (const api of ['/info', '/block/current']) {
        it(`supports native arweave node apis ${api}`, async () => {
          const [nativeAxios, response] = await Promise.all([
            axios(`https://${gatewayUrl}${api}`),
            wayfinder.request(`ar://${api}`),
          ]);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeAxios.status);
          // TODO: ensure the headers are the same excluding unique headers
        });
      }

      for (const api of ['/ar-io/info', '/ar-io/__gateway_metrics']) {
        it(`supports native ario node gateway apis ${api}`, async () => {
          const [nativeAxios, response] = await Promise.all([
            axios(`https://${gatewayUrl}${api}`),
            wayfinder.request(`ar:///${api}`),
          ]);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeAxios.status);
          // TODO: ensure the headers are the same excluding unique headers
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
          axiosInstance(`https://${gatewayUrl}/ar-io/not-found`),
          wayfinder.request('ar:///not-found'),
        ]);
        assert.strictEqual(response.status, nativeAxios.status);
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
          got(`https://ao.${gatewayUrl}`),
          wayfinder.request('ar://ao'),
        ]);
        assert.strictEqual(response.statusCode, 200);
        assert.strictEqual(response.statusCode, nativeGot.statusCode);
        assert.deepStrictEqual(response.body, nativeGot.body);
      });

      it('should stream the data using got.stream against the selected target gateway', async () => {
        const nativeBuffer = await buffer(
          await got.stream(`https://ao.${gatewayUrl}`, { decompress: false }),
        );
        const wayfinderBuffer = await buffer(
          await wayfinder.request.stream('ar://ao', { decompress: false }),
        );
        assert.deepStrictEqual(wayfinderBuffer, nativeBuffer);
      });
    });
  });
});
