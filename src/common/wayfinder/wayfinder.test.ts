import axios from 'axios';
import got from 'got';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { before, describe, it } from 'node:test';

import { Logger } from '../../common/logger.js';
import { GatewaysProvider } from '../../types/wayfinder.js';
import { RandomRoutingStrategy } from './routing/strategies/random.js';
import { StaticRoutingStrategy } from './routing/strategies/static.js';
import { Wayfinder, tapAndVerifyStream } from './wayfinder.js';

// TODO: replace with locally running gateway
const gatewayUrl = 'permagate.io';
const stubbedGatewaysProvider: GatewaysProvider = {
  getGateways: async () => [new URL(`http://${gatewayUrl}`)],
} as unknown as GatewaysProvider;

Logger.default.setLogLevel('none');

describe('Wayfinder', () => {
  describe('http wrapper', () => {
    describe('fetch', () => {
      let wayfinder: Wayfinder<typeof fetch>;
      before(() => {
        wayfinder = new Wayfinder({
          httpClient: fetch,
          routingStrategy: new RandomRoutingStrategy(),
          gatewaysProvider: stubbedGatewaysProvider,
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
            redirect: 'follow',
          }),
          wayfinder.request(`https://${gatewayUrl}/`, {
            method: 'HEAD',
            redirect: 'follow',
          }),
        ]);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeFetch.status);
        // TODO: ensure the headers are the same excluding unique headers
      });

      for (const api of ['/info', '/block/current']) {
        it.skip(`supports native arweave node apis ${api}`, async () => {
          const [nativeFetch, response] = await Promise.all([
            fetch(`https://${gatewayUrl}${api}`, {
              redirect: 'follow',
            }),
            wayfinder.request(`ar://${api}`, {
              redirect: 'follow',
            }),
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
          redirect: 'follow',
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
          fetch(`https://${gatewayUrl}/ar-io/not-found`, {
            redirect: 'follow',
          }),
          wayfinder.request('ar:///ar-io/not-found', {
            redirect: 'follow',
          }),
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
          routingStrategy: new RandomRoutingStrategy(),
          gatewaysProvider: stubbedGatewaysProvider,
        });
      });
      it('should fetch the data using axios default function against the target gateway', async () => {
        const [nativeAxios, response] = await Promise.all([
          axios(`https://ao.${gatewayUrl}`),
          wayfinder.request('ar://ao', {
            maxRedirects: 5,
          }),
        ]);
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
        it.skip(`supports native arweave node apis ${api}`, async () => {
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
            wayfinder.request(`ar://${api}`),
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
          routingStrategy: new RandomRoutingStrategy(),
        });
        const [nativeAxios, response] = await Promise.all([
          axiosInstance(`https://${gatewayUrl}/ar-io/not-found`),
          wayfinder.request('ar:///ar-io/not-found'),
        ]);
        assert.strictEqual(response.status, nativeAxios.status);
      });
    });

    describe('got', () => {
      let wayfinder: Wayfinder<typeof got>;
      before(() => {
        wayfinder = new Wayfinder({
          httpClient: got,
          routingStrategy: new RandomRoutingStrategy(),
          gatewaysProvider: stubbedGatewaysProvider,
        });
      });

      it('should fetch the data using the got default function against the target gateway', async () => {
        const [nativeGot, response] = await Promise.all([
          got(`https://ao.${gatewayUrl}`),
          wayfinder.request('ar://ao'),
        ]);
        assert.strictEqual(response.statusCode, nativeGot.statusCode);
        assert.deepStrictEqual(response.body, nativeGot.body);
      });

      it('should stream the data using got.stream against the selected target gateway', async () => {
        const nativeBuffer = await buffer(
          await got.stream(`https://ao.${gatewayUrl}`, {
            decompress: false,
            followRedirect: true,
          }),
        );
        const wayfinderBuffer = await buffer(
          await wayfinder.request.stream('ar://ao', {
            decompress: false,
            followRedirect: true,
          }),
        );
        assert.deepStrictEqual(wayfinderBuffer, nativeBuffer);
      });
    });
  });

  describe('events', () => {
    it('should emit events on the wayfinder event emitter', async () => {
      const wayfinder = new Wayfinder({
        httpClient: fetch,
        routingStrategy: new StaticRoutingStrategy({
          gateway: `http://${gatewayUrl}`,
        }),
        verificationStrategy: {
          // @ts-expect-error
          verifyData: async (params: { data: Buffer; txId: string }) => {
            return;
          },
        },
      });
      const events: { type: string; txId: string }[] = [];
      wayfinder.emitter.on('verification-failed', (event) => {
        events.push({ type: 'verification-failed', ...event });
      });
      wayfinder.emitter.on('verification-progress', (event) => {
        events.push({ type: 'verification-progress', ...event });
      });
      wayfinder.emitter.on('verification-passed', (event) => {
        events.push({ type: 'verification-passed', ...event });
      });
      // request data and assert the event is emitted
      const response = await wayfinder.request(
        'ar://c7wkwt6TKgcWJUfgvpJ5q5qi4DIZyJ1_TqhjXgURh0U',
        {
          redirect: 'follow',
        },
      );
      // read the full response body to ensure the stream is fully consumed
      await response.text();
      assert.strictEqual(response.status, 200);
      assert.ok(
        events.find((e) => e.type === 'verification-passed'),
        'Should emit at least one verification-passed',
      );
    });

    it('should execute callbacks provided to the wayfinder constructor', async () => {
      let verificationFailed = false;
      let verificationProgress = false;
      let verificationPassed = false;
      const wayfinder = new Wayfinder({
        httpClient: fetch,
        routingStrategy: new StaticRoutingStrategy({
          gateway: `http://${gatewayUrl}`,
        }),
        events: {
          onVerificationFailed: () => {
            verificationFailed = true;
          },
          onVerificationProgress: () => {
            verificationProgress = true;
          },
          onVerificationPassed: () => {
            verificationPassed = true;
          },
        },
      });
      const response = await wayfinder.request(
        'ar://c7wkwt6TKgcWJUfgvpJ5q5qi4DIZyJ1_TqhjXgURh0U',
        {
          redirect: 'follow',
        },
      );
      // read the full response body to ensure the stream is fully consumed
      await response.text();
      assert.strictEqual(response.status, 200);
      assert.ok(
        verificationFailed === false,
        'Should not emit verification-failed',
      );
      assert.ok(verificationProgress, 'Should emit verification-progress');
      assert.ok(verificationPassed, 'Should emit verification-passed');
    });
  });

  describe('tapAndVerifyRequest', () => {
    describe('Readable', () => {
      it('should duplicate the stream, verify the first and return the second if verification passes', async () => {
        // create a simple readable
        const chunks = [
          Buffer.from('foo'),
          Buffer.from('bar'),
          Buffer.from('baz'),
        ];
        const contentLength = chunks.reduce((sum, c) => sum + c.length, 0);

        // a stream that will emit chunks
        const originalStream = Readable.from(chunks);
        let seen = Buffer.alloc(0);
        const verifyData = async ({
          data,
          // @ts-expect-error
          txId,
        }: {
          data: Readable;
          txId: string;
        }): Promise<void> => {
          return new Promise((resolve, reject) => {
            data.on('data', (chunk) => {
              seen = Buffer.concat([seen, chunk]);
            });
            data.on('end', () => {
              // Should have seen exactly the full payload
              assert.strictEqual(seen.length, contentLength);
              resolve();
            });
            data.on('error', reject);
          });
        };

        const txId = 'test-tx-1';
        const emitter = new EventEmitter();
        const events: { type: string; txId: string }[] = [];
        emitter.on('verification-progress', (e) => {
          events.push({ type: 'verification-progress', ...e });
        });
        emitter.on('verification-passed', (e) =>
          events.push({ type: 'verification-passed', ...e }),
        );

        // tap with verification
        const tapped = tapAndVerifyStream({
          originalStream,
          contentLength,
          verifyData,
          txId,
          emitter,
        });

        // read the stream
        const out: Buffer[] = [];
        for await (const chunk of tapped) {
          out.push(chunk);
        }

        // assert the stream is the same
        assert.strictEqual(
          Buffer.concat(out).toString(),
          Buffer.concat(chunks).toString(),
          'The tapped stream should emit exactly the original data',
        );

        assert.ok(
          events.find((e) => e.type === 'verification-progress'),
          'Should emit at least one verification-progress',
        );
        assert.ok(
          events.find(
            (e) => e.type === 'verification-passed' && e.txId === txId,
          ),
          'Should emit at least one verification-passed',
        );
      });

      it('should throw an error on the client stream if verification fails', async () => {
        const chunks = [
          Buffer.from('foo'),
          Buffer.from('bar'),
          Buffer.from('baz'),
        ];
        const contentLength = chunks.reduce((sum, c) => sum + c.length, 0);

        // a stream that will emit chunks
        const originalStream = Readable.from(chunks);
        const verifyData = async ({
          // @ts-expect-error
          data,
          txId,
        }: {
          data: Readable;
          txId: string;
        }): Promise<void> => {
          throw new Error('Verification failed for txId: ' + txId);
        };

        const txId = 'test-tx-1';
        const emitter = new EventEmitter();
        const events: { type: string; txId: string }[] = [];
        emitter.on('verification-progress', (e) =>
          events.push({ type: 'verification-progress', ...e }),
        );
        emitter.on('verification-failed', (e) =>
          events.push({ type: 'verification-failed', ...e }),
        );

        // tap with verification
        const tapped = tapAndVerifyStream({
          originalStream,
          contentLength,
          verifyData,
          txId,
          emitter,
        });

        // read the stream
        try {
          const out: Buffer[] = [];
          for await (const chunk of tapped) {
            out.push(chunk);
          }
        } catch (error) {
          assert.ok(
            events.find(
              (e) => e.type === 'verification-failed' && e.txId === txId,
            ),
            'Should emit at least one verification-failed',
          );
          // stream should be closed
          assert.ok(tapped.closed);
        }
      });
    });

    describe('ReadableStream', () => {
      it('should duplicate the ReadableStream, verify the first and return the second if verification passes', async () => {
        // create a simple readable
        const chunks = [
          Buffer.from('foo'),
          Buffer.from('bar'),
          Buffer.from('baz'),
        ];
        const contentLength = chunks.reduce((sum, c) => sum + c.length, 0);

        // a stream that will emit chunks
        const originalStream = ReadableStream.from(chunks);
        let seen = Buffer.alloc(0);
        const verifyData = async ({
          data,
          // @ts-expect-error
          txId,
        }: {
          data: ReadableStream;
          txId: string;
        }): Promise<void> => {
          return new Promise(async (resolve, reject) => {
            const reader = data.getReader();
            while (true) {
              try {
                const { done, value } = await reader.read();
                if (done) {
                  resolve();
                  break;
                }
                seen = Buffer.concat([seen, value]);
              } catch (error) {
                reject(error);
              }
            }
          });
        };

        const txId = 'test-tx-1';
        const emitter = new EventEmitter();
        const events: { type: string; txId: string }[] = [];
        emitter.on('verification-progress', (e) =>
          events.push({ type: 'verification-progress', ...e }),
        );
        emitter.on('verification-passed', (e) =>
          events.push({ type: 'verification-passed', ...e }),
        );

        // tap with verification
        const tapped = tapAndVerifyStream({
          originalStream,
          contentLength,
          verifyData,
          txId,
          emitter,
        });

        // read the stream
        const out: Buffer[] = [];
        for await (const chunk of tapped) {
          out.push(chunk);
        }

        // assert the stream is the same
        assert.strictEqual(
          Buffer.concat(out).toString(),
          Buffer.concat(chunks).toString(),
          'The tapped stream should emit exactly the original data',
        );

        assert.ok(
          events.find((e) => e.type === 'verification-progress'),
          'Should emit at least one verification-progress',
        );
        assert.ok(
          events.find(
            (e) => e.type === 'verification-passed' && e.txId === txId,
          ),
          'Should emit at least one verification-passed',
        );
      });

      it('should throw an error on the client stream if verification fails', async () => {
        const chunks = [
          Buffer.from('foo'),
          Buffer.from('bar'),
          Buffer.from('baz'),
        ];
        const contentLength = chunks.reduce((sum, c) => sum + c.length, 0);

        // a stream that will emit chunks
        const originalStream = ReadableStream.from(chunks);
        const verifyData = async ({
          // @ts-expect-error
          data,
          txId,
        }: {
          data: ReadableStream;
          txId: string;
        }): Promise<void> => {
          throw new Error('Verification failed for txId: ' + txId);
        };

        const txId = 'test-tx-1';
        const emitter = new EventEmitter();
        const events: { type: string; txId: string }[] = [];
        emitter.on('verification-progress', (e) =>
          events.push({ type: 'verification-progress', ...e }),
        );
        emitter.on('verification-failed', (e) =>
          events.push({ type: 'verification-failed', ...e }),
        );

        // tap with verification
        const tapped = tapAndVerifyStream({
          originalStream,
          contentLength,
          verifyData,
          txId,
          emitter,
        });

        // read the stream
        try {
          const out: Buffer[] = [];
          for await (const chunk of tapped) {
            out.push(chunk);
          }
        } catch (error) {
          assert.ok(
            events.find(
              (e) => e.type === 'verification-failed' && e.txId === txId,
            ),
            'Should emit at least one verification-failed',
          );
        }
      });
    });
  });
});
