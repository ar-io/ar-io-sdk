import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { before, describe, it } from 'node:test';

import { Logger } from '../../common/logger.js';
import { GatewaysProvider } from '../../types/wayfinder.js';
import { RandomRoutingStrategy } from './routing/strategies/random.js';
import { StaticRoutingStrategy } from './routing/strategies/static.js';
import {
  Wayfinder,
  WayfinderEmitter,
  tapAndVerifyReadableStream,
} from './wayfinder.js';

// TODO: replace with locally running gateway
const gatewayUrl = 'permagate.io';
const stubbedGatewaysProvider: GatewaysProvider = {
  getGateways: async () => [new URL(`http://${gatewayUrl}`)],
} as unknown as GatewaysProvider;

Logger.default.setLogLevel('none');

describe('Wayfinder', () => {
  describe('http wrapper', () => {
    describe('fetch', () => {
      let wayfinder: Wayfinder;
      before(() => {
        wayfinder = new Wayfinder({
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
        // wayfinder redirects by default
        const response = await wayfinder.request(
          'ar://KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A',
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
          wayfinder.request(`https://${gatewayUrl}/`, { method: 'HEAD' }),
        ]);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.status, nativeFetch.status);
        // TODO: ensure the headers are the same excluding unique headers
      });

      for (const api of ['/info', '/block/current']) {
        it.skip(`supports native arweave node apis ${api}`, async () => {
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
          wayfinder.request('ar:///ar-io/not-found'),
        ]);
        assert.strictEqual(response.status, nativeFetch.status);
        assert.strictEqual(response.statusText, nativeFetch.statusText);
      });
    });
  });

  describe('events', () => {
    it('should emit events on the wayfinder event emitter', async () => {
      const wayfinder = new Wayfinder({
        routingStrategy: new StaticRoutingStrategy({
          gateway: `http://${gatewayUrl}`,
        }),
        verificationStrategy: {
          verifyData: async (params: {
            data: AsyncIterable<Uint8Array>;
            txId: string;
          }) => {
            return;
          },
        },
      });
      const events: unknown[] = [];
      wayfinder.emitter.on('verification-failed', (event) => {
        events.push({ type: 'verification-failed', ...event });
      });
      wayfinder.emitter.on('verification-progress', (event) => {
        events.push({ type: 'verification-progress', ...event });
      });
      wayfinder.emitter.on('verification-succeeded', (event) => {
        events.push({ type: 'verification-succeeded', ...event });
      });
      // request data and assert the event is emitted
      const response = await wayfinder.request(
        'ar://c7wkwt6TKgcWJUfgvpJ5q5qi4DIZyJ1_TqhjXgURh0U',
      );
      // read the full response body to ensure the stream is fully consumed
      await response.text();
      assert.strictEqual(response.status, 200);
      assert.ok(
        events.find((e: any) => e.type === 'verification-succeeded'),
        'Should emit at least one verification-succeeded',
      );
    });

    it('should execute callbacks provided to the wayfinder constructor', async () => {
      let verificationFailed = false;
      let verificationProgress = false;
      let verificationSucceeded = false;
      const wayfinder = new Wayfinder({
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
          onVerificationSucceeded: () => {
            verificationSucceeded = true;
          },
        },
        strict: true,
      });
      const response = await wayfinder.request(
        'ar://c7wkwt6TKgcWJUfgvpJ5q5qi4DIZyJ1_TqhjXgURh0U',
      );
      // read the full response body to ensure the stream is fully consumed
      await response.text();
      assert.strictEqual(response.status, 200);
      assert.ok(
        verificationFailed === false,
        'Should not emit verification-failed',
      );
      assert.ok(verificationProgress, 'Should emit verification-progress');
      assert.ok(verificationSucceeded, 'Should emit verification-succeeded');
    });
  });

  describe('tapAndVerifyReadableStream', () => {
    describe('strict mode enabled', () => {
      it('should duplicate the ReadableStream, verify the first and return the second if verification passes', async () => {
        // create a simple readable
        const chunks = [
          Buffer.from('foo'),
          Buffer.from('bar'),
          Buffer.from('baz'),
        ];
        const contentLength = chunks.reduce((sum, c) => sum + c.length, 0);

        // a stream that will emit chunks
        const originalStream = new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        });
        let seen = Buffer.alloc(0);
        const verifyData = async ({
          data,
          txId,
        }: {
          data: AsyncIterable<Uint8Array>;
          txId: string;
        }): Promise<void> => {
          // verify the data
          for await (const chunk of data) {
            seen = Buffer.concat([seen, chunk]);
          }
        };

        const txId = 'test-tx-1';
        const emitter = new WayfinderEmitter();
        const events: any[] = [];
        emitter.on('verification-progress', (e) =>
          events.push({ type: 'verification-progress', ...e }),
        );
        emitter.on('verification-succeeded', (e) =>
          events.push({ type: 'verification-succeeded', ...e }),
        );

        // tap with verification
        const tapped = tapAndVerifyReadableStream({
          originalStream,
          contentLength,
          verifyData,
          txId,
          emitter,
          strict: true,
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
            (e) => e.type === 'verification-succeeded' && e.txId === txId,
          ),
          'Should emit at least one verification-succeeded',
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
        const originalStream = new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        });
        const verifyData = async ({
          data,
          txId,
        }: {
          data: AsyncIterable<Uint8Array>;
          txId: string;
        }): Promise<void> => {
          throw new Error('Verification failed for txId: ' + txId);
        };

        const txId = 'test-tx-1';
        const emitter = new WayfinderEmitter();
        const events: any[] = [];
        emitter.on('verification-progress', (e) =>
          events.push({ type: 'verification-progress', ...e }),
        );
        emitter.on('verification-failed', (e) =>
          events.push({ type: 'verification-failed', ...e }),
        );

        // tap with verification (using strict mode)
        const tapped = tapAndVerifyReadableStream({
          originalStream,
          contentLength,
          verifyData,
          txId,
          emitter,
          strict: true,
        });

        // read the stream and expect verification to fail
        try {
          const out: Buffer[] = [];
          const reader = tapped.getReader();
          while (true) {
            try {
              const { done, value } = await reader.read();
              if (done) break;
              out.push(Buffer.from(value));
            } catch (error) {
              // This is expected - verification should fail
              break;
            }
          }
          // If we get here, verification didn't throw as expected
          assert.fail('Should have thrown an error during verification');
        } catch (error) {
          // Wait a bit for the event to be emitted
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Now we should have the verification-failed event
          assert.ok(events.length > 0, 'Should have emitted events');

          // Check if one of them is verification-failed
          const failedEvent = events.find(
            (e) => e.type === 'verification-failed',
          );
          assert.ok(
            failedEvent,
            'Should emit at least one verification-failed event',
          );
        }
      });
    });
  });

  describe('URL resolution', () => {
    let wayfinder: Wayfinder;
    before(() => {
      wayfinder = new Wayfinder({
        routingStrategy: new StaticRoutingStrategy({
          gateway: `http://${gatewayUrl}`,
        }),
        gatewaysProvider: stubbedGatewaysProvider,
      });
    });

    describe('Non-ar:// URLs (fallback)', () => {
      it('should pass through non-ar:// URLs unchanged', async () => {
        const originalUrl = 'https://example.com/path';
        const resolvedUrl = await wayfinder.resolveUrl({
          originalUrl,
        });

        assert.strictEqual(resolvedUrl.toString(), originalUrl);
      });

      it('should return unchanged HTTPS URLs with query params', async () => {
        const originalUrl =
          'https://api.example.com/v1/data?key=value&limit=10';
        const result = await wayfinder.resolveUrl({
          originalUrl,
        });

        assert.strictEqual(result.toString(), originalUrl);
      });

      it('should return unchanged file:// URLs', async () => {
        const originalUrl = 'file:///path/to/local/file.txt';
        const result = await wayfinder.resolveUrl({
          originalUrl,
        });

        assert.strictEqual(result.toString(), originalUrl);
      });
    });

    describe('Gateway endpoint routing (path starts with /)', () => {
      it('should route to gateway endpoints correctly', async () => {
        const resolvedUrl = await wayfinder.resolveUrl({
          originalUrl: 'ar:///ar-io/info',
        });

        assert.strictEqual(
          resolvedUrl.toString(),
          `http://${gatewayUrl}/ar-io/info`,
        );
      });

      it('should route single-level gateway endpoints', async () => {
        const result = await wayfinder.resolveUrl({
          originalUrl: 'ar:///info',
        });

        assert.strictEqual(result.toString(), `http://${gatewayUrl}/info`);
      });

      it('should route gateway endpoints with query params', async () => {
        const result = await wayfinder.resolveUrl({
          originalUrl: 'ar:///graphql?query=test',
        });

        assert.strictEqual(
          result.toString(),
          `http://${gatewayUrl}/graphql?query=test`,
        );
      });

      it('should handle empty gateway endpoint (just ar:///)', async () => {
        const result = await wayfinder.resolveUrl({
          originalUrl: 'ar:///',
        });

        assert.strictEqual(result.toString(), `http://${gatewayUrl}/`);
      });
    });

    describe('Transaction ID routing (txIdRegex)', () => {
      const validTxId = 'c7wkwt6TKgcWJUfgvpJ5q5qi4DIZyJ1_TqhjXgURh0U';
      const sandboxForTxId =
        'oo6cjqw6smvaofrfi7ql5etzvonkfybsdhej272ovbrv4birq5cq';

      it('should resolve transaction IDs without path components to the proper sandbox url', async () => {
        const resolvedUrl = await wayfinder.resolveUrl({
          originalUrl: `ar://${validTxId}`,
        });

        assert.strictEqual(
          resolvedUrl.toString(),
          `http://${sandboxForTxId}.${gatewayUrl}/${validTxId}`,
        );
      });

      it('should resolve transaction IDs with path segments', async () => {
        const resolvedUrl = await wayfinder.resolveUrl({
          originalUrl: `ar://${validTxId}/path/to/file.html`,
        });

        assert.strictEqual(
          resolvedUrl.toString(),
          `http://${sandboxForTxId}.${gatewayUrl}/${validTxId}/path/to/file.html`,
        );
      });

      it('should route transaction IDs with multiple path segments', async () => {
        const result = await wayfinder.resolveUrl({
          originalUrl: `ar://${validTxId}/assets/images/logo.png`,
        });

        assert.strictEqual(
          result.toString(),
          `http://${sandboxForTxId}.${gatewayUrl}/${validTxId}/assets/images/logo.png`,
        );
      });

      it('should route transaction IDs with query parameters', async () => {
        const result = await wayfinder.resolveUrl({
          originalUrl: `ar://${validTxId}/api/data?format=json&limit=50`,
        });

        assert.strictEqual(
          result.toString(),
          `http://${sandboxForTxId}.${gatewayUrl}/${validTxId}/api/data?format=json&limit=50`,
        );
      });
    });

    describe('ARNS name routing (arnsRegex)', () => {
      describe('Basic ARNS names with path components', () => {
        it('should resolve ARNS names without path components', async () => {
          const resolvedUrl = await wayfinder.resolveUrl({
            originalUrl: 'ar://cookbook_ao',
          });

          assert.strictEqual(
            resolvedUrl.toString(),
            `http://cookbook_ao.${gatewayUrl}/`,
          );
        });

        it('should resolve top-level ARNS names with single path segment', async () => {
          const resolvedUrl = await wayfinder.resolveUrl({
            originalUrl: 'ar://ao/welcome',
          });

          assert.strictEqual(
            resolvedUrl.toString(),
            `http://ao.${gatewayUrl}/welcome`,
          );
        });

        it('should resolve top-level ARNS names with multiple path segments', async () => {
          const resolvedUrl = await wayfinder.resolveUrl({
            originalUrl: 'ar://ao/welcome/getting-started.html',
          });

          assert.strictEqual(
            resolvedUrl.toString(),
            `http://ao.${gatewayUrl}/welcome/getting-started.html`,
          );
        });

        it('should resolve ARNS names with undernames and single path segment', async () => {
          const resolvedUrl = await wayfinder.resolveUrl({
            originalUrl: 'ar://cookbook_ao/welcome',
          });

          assert.strictEqual(
            resolvedUrl.toString(),
            `http://cookbook_ao.${gatewayUrl}/welcome`,
          );
        });

        it('should resolve ARNS names with undernames and multiple path segments', async () => {
          const resolvedUrl = await wayfinder.resolveUrl({
            originalUrl: 'ar://cookbook_ao/welcome/getting-started.html',
          });

          assert.strictEqual(
            resolvedUrl.toString(),
            `http://cookbook_ao.${gatewayUrl}/welcome/getting-started.html`,
          );
        });

        it('should resolve ARNS names with deep nested paths', async () => {
          const resolvedUrl = await wayfinder.resolveUrl({
            originalUrl: 'ar://cookbook_ao/api/v1/users/123/profile',
          });

          assert.strictEqual(
            resolvedUrl.toString(),
            `http://cookbook_ao.${gatewayUrl}/api/v1/users/123/profile`,
          );
        });
      });

      describe('ARNS names with special characters', () => {
        it('should route ARNS names with hyphens', async () => {
          const result = await wayfinder.resolveUrl({
            originalUrl: 'ar://my-app/dashboard',
          });

          assert.strictEqual(
            result.toString(),
            `http://my-app.${gatewayUrl}/dashboard`,
          );
        });

        it('should route ARNS names with numbers', async () => {
          const result = await wayfinder.resolveUrl({
            originalUrl: 'ar://app2024/features',
          });

          assert.strictEqual(
            result.toString(),
            `http://app2024.${gatewayUrl}/features`,
          );
        });
      });

      describe('ARNS names with query parameters', () => {
        it('should preserve query parameters in ARNS routing', async () => {
          const result = await wayfinder.resolveUrl({
            originalUrl: 'ar://cookbook_ao/search?q=testing&category=tutorials',
          });

          assert.strictEqual(
            result.toString(),
            `http://cookbook_ao.${gatewayUrl}/search?q=testing&category=tutorials`,
          );
        });
      });

      describe('Edge cases for valid ARNS names', () => {
        it('should handle single character ARNS names', async () => {
          const result = await wayfinder.resolveUrl({
            originalUrl: 'ar://x/path',
          });

          assert.strictEqual(result.toString(), `http://x.${gatewayUrl}/path`);
        });

        it('should handle maximum length ARNS names (51 chars)', async () => {
          const maxLengthName = 'a'.repeat(51);
          const result = await wayfinder.resolveUrl({
            originalUrl: `ar://${maxLengthName}/test`,
          });

          assert.strictEqual(
            result.toString(),
            `http://${maxLengthName}.${gatewayUrl}/test`,
          );
        });

        it('should treat short IDs as ARNS names when they match arnsRegex', async () => {
          const shortId = 'abc123';
          const originalUrl = `ar://${shortId}/path`;
          const result = await wayfinder.resolveUrl({
            originalUrl,
          });

          // Short IDs that don't match txIdRegex but match arnsRegex get treated as ARNS names
          assert.strictEqual(
            result.toString(),
            `http://${shortId}.${gatewayUrl}/path`,
          );
        });

        it('should treat long IDs as ARNS names when they match arnsRegex', async () => {
          const longId = 'a'.repeat(44);
          const originalUrl = `ar://${longId}/path`;
          const result = await wayfinder.resolveUrl({
            originalUrl,
          });

          // Long IDs that don't match txIdRegex but match arnsRegex get treated as ARNS names
          assert.strictEqual(
            result.toString(),
            `http://${longId}.${gatewayUrl}/path`,
          );
        });
      });
    });

    describe('Invalid names (no regex match - fallback)', () => {
      it('should fallback for ARNS names that are too long (>51 chars)', async () => {
        const tooLongName = 'a'.repeat(52);
        const originalUrl = `ar://${tooLongName}/path`;
        const result = await wayfinder.resolveUrl({
          originalUrl,
        });

        assert.strictEqual(result.toString(), originalUrl);
      });

      it('should fallback for names with invalid characters', async () => {
        const invalidName = 'my.app';
        const originalUrl = `ar://${invalidName}/path`;
        const result = await wayfinder.resolveUrl({
          originalUrl,
        });

        assert.strictEqual(result.toString(), originalUrl);
      });

      it('should fallback for names with uppercase letters', async () => {
        const upperCaseName = 'MyApp';
        const originalUrl = `ar://${upperCaseName}/path`;
        const result = await wayfinder.resolveUrl({
          originalUrl,
        });

        assert.strictEqual(result.toString(), originalUrl);
      });

      it('should fallback for empty names', async () => {
        const originalUrl = 'ar://';
        const result = await wayfinder.resolveUrl({
          originalUrl,
        });

        assert.strictEqual(result.toString(), originalUrl);
      });
    });
  });
});
