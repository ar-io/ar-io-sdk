import axios from 'axios';
import got from 'got';
import assert from 'node:assert';
import { buffer } from 'node:stream/consumers';
import { before, describe, it } from 'node:test';

import { Logger } from '../../common/logger.js';
<<<<<<< HEAD
=======
import { AoGatewayWithAddress } from '../../types/io.js';
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
import { GatewaysProvider } from './gateways.js';
import { RandomGatewayRouter } from './routers/random.js';
import { Wayfinder } from './wayfinder.js';

<<<<<<< HEAD
const gatewayUrl = 'permagate.io';
=======
const stubbedGateway: AoGatewayWithAddress = {
  status: 'joined',
  gatewayAddress: 'arweave',
  operatorStake: 1000,
  totalDelegatedStake: 1000,
  startTimestamp: 1000,
  settings: {
    protocol: 'https',
    fqdn: 'permagate.io',
    port: 443,
  },
} as unknown as AoGatewayWithAddress;
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
const stubbedGatewaysProvider: GatewaysProvider = {
  getGateways: async () => [new URL(`https://${gatewayUrl}`)],
} as unknown as GatewaysProvider;

<<<<<<< HEAD
Logger.default.setLogLevel('debug');
=======
Logger.default.setLogLevel('none');
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)

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
<<<<<<< HEAD
        const nativeFetch = await fetch(`https://ao.${gatewayUrl}`);
=======
        const nativeFetch = await fetch('https://ao.permagate.io');
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
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
<<<<<<< HEAD
          `https://${gatewayUrl}/KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A`,
=======
          'https://permagate.io/KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A',
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
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
<<<<<<< HEAD
          fetch(`https://${gatewayUrl}/`, {
            method: 'HEAD',
          }),
          wayfinder.request(`https://${gatewayUrl}/`, {
=======
          fetch('https://permagate.io/', {
            method: 'HEAD',
          }),
          wayfinder.request('https://permagate.io/', {
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
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
<<<<<<< HEAD
            fetch(`https://${gatewayUrl}${api}`),
            wayfinder.request(`ar://${api}`),
=======
            fetch(`https://permagate.io${api}`),
            wayfinder.request(`ar:///${api}`),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
          ]);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeFetch.status);
          // TODO: ensure the headers are the same excluding unique headers
        });
      }

      for (const api of ['/ar-io/info']) {
        it(`supports native ario node gateway apis ${api}`, async () => {
          const [nativeFetch, response] = await Promise.all([
<<<<<<< HEAD
            fetch(`https://${gatewayUrl}${api}`),
=======
            fetch(`https://permagate.io${api}`),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
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

      it.skip('returns the error from the target gateway if the route is not found', async () => {
        const [nativeFetch, response] = await Promise.all([
<<<<<<< HEAD
          fetch(`https://${gatewayUrl}/ar-io/not-found`),
          wayfinder.request('ar:///not-found'),
=======
          fetch('https://permagate.io/not-found'),
          wayfinder.request('https://permagate.io/not-found'),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
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
<<<<<<< HEAD
          axios(`https://ao.${gatewayUrl}`),
=======
          axios('https://ao.permagate.io'),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
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
<<<<<<< HEAD
          axios.get(`https://ao.${gatewayUrl}`),
=======
          axios.get('https://ao.permagate.io'),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
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
<<<<<<< HEAD
          axios(`https://${gatewayUrl}/`),
          wayfinder.request(`https://${gatewayUrl}/`),
=======
          axios('https://permagate.io/'),
          wayfinder.request('https://permagate.io/'),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
        ]);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeAxios.status);
        // TODO: ensure the headers are the same excluding unique headers
      });

      for (const api of ['/info', '/block/current']) {
        it(`supports native arweave node apis ${api}`, async () => {
          const [nativeAxios, response] = await Promise.all([
<<<<<<< HEAD
            axios(`https://${gatewayUrl}${api}`),
            wayfinder.request(`ar://${api}`),
=======
            axios(`https://permagate.io${api}`),
            wayfinder.request(`ar:///${api}`),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
          ]);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeAxios.status);
          // TODO: ensure the headers are the same excluding unique headers
        });
      }

      for (const api of ['/ar-io/info', '/ar-io/__gateway_metrics']) {
        it(`supports native ario node gateway apis ${api}`, async () => {
          const [nativeAxios, response] = await Promise.all([
<<<<<<< HEAD
            axios(`https://${gatewayUrl}${api}`),
=======
            axios(`https://permagate.io${api}`),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
            wayfinder.request(`ar:///${api}`),
          ]);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.status, nativeAxios.status);
          // TODO: ensure the headers are the same excluding unique headers
        });
      }

      it.skip('should return the error from the target gateway if the route is not found', async () => {
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
<<<<<<< HEAD
          axiosInstance(`https://${gatewayUrl}/ar-io/not-found`),
          wayfinder.request('ar:///not-found'),
=======
          axiosInstance('https://permagate.io/not-found'),
          wayfinder.request('https://permagate.io/not-found'),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
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
<<<<<<< HEAD
          got(`https://ao.${gatewayUrl}`),
=======
          got('https://ao.permagate.io'),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
          wayfinder.request('ar://ao'),
        ]);
        assert.strictEqual(response.statusCode, 200);
        assert.strictEqual(response.statusCode, nativeGot.statusCode);
        assert.deepStrictEqual(response.body, nativeGot.body);
      });

      it('should stream the data using got.stream against the selected target gateway', async () => {
        const nativeBuffer = await buffer(
<<<<<<< HEAD
          await got.stream(`https://ao.${gatewayUrl}`, { decompress: false }),
=======
          await got.stream('https://ao.permagate.io', { decompress: false }),
>>>>>>> d4cf00c (feat(wayfinder): add initial data verification interfaces and classes)
        );
        const wayfinderBuffer = await buffer(
          await wayfinder.request.stream('ar://ao', { decompress: false }),
        );
        assert.deepStrictEqual(wayfinderBuffer, nativeBuffer);
      });
    });
  });
});
