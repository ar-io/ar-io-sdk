import Arweave from 'arweave';
import {
  LoggerFactory,
  WarpFactory,
  defaultCacheOptions,
} from 'warp-contracts';
import { DeployPlugin } from 'warp-contracts-plugin-deploy';

import { SmartWeaveSortKey } from '../src/utils';

const GATEWAY_PORT = process.env.GATEWAY_PORT ?? 1984;
const GATEWAY_HOST = process.env.GATEWAY_HOST ?? '127.0.0.1';
const GATEWAY_PROTOCOL = process.env.GATEWAY_PROTOCOL ?? 'http';
// Arweave
export const arweave = new Arweave({
  protocol: GATEWAY_PROTOCOL,
  port: GATEWAY_PORT,
  host: GATEWAY_HOST,
});

LoggerFactory.INST.logLevel('fatal');
export const warp = WarpFactory.forMainnet(
  defaultCacheOptions,
  true,
  arweave,
).use(new DeployPlugin());

export const gatewayAddress = '1H7WZIWhzwTH9FIcnuMqYkTsoyv1OTfGa_amvuYwrgo';
export const testDomain = 'angela';
export const evaluateToBlockHeight = 1377100;
export const evaluateToSortKey = new SmartWeaveSortKey(
  '000001376946,0000000000000,18d52956c8e13ae1f557b4e67f6f298b8ffd2a5cd96e42ec24ca649b7401510f',
);
export const localCacheUrl =
  process.env.REMOTE_CACHE_URL || 'http://localhost:3000';
