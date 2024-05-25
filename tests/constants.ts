import Arweave from 'arweave';
import { LoggerFactory, WarpFactory } from 'warp-contracts';
import { DeployPlugin } from 'warp-contracts-plugin-deploy';

export const GATEWAY_PORT = +(process.env.GATEWAY_PORT ?? 1984);
export const GATEWAY_HOST = process.env.GATEWAY_HOST ?? 'localhost';
export const GATEWAY_PROTOCOL = process.env.GATEWAY_PROTOCOL ?? 'http';

// Arweave
export const arweave = new Arweave({
  protocol: GATEWAY_PROTOCOL,
  port: GATEWAY_PORT,
  host: GATEWAY_HOST,
});

LoggerFactory.INST.logLevel('fatal');
export const warp = WarpFactory.forLocal(1984, arweave).use(new DeployPlugin());

export const gatewayAddress = '1H7WZIWhzwTH9FIcnuMqYkTsoyv1OTfGa_amvuYwrgo';
export const testDomain = 'test-record';
export const evaluateToBlockHeight = 1;
export const evaluateToSortKey =
  '000000000000,0000000000000,0000000000000000000000000000000000000000000000000000000000000000';
export const localCacheUrl =
  process.env.REMOTE_CACHE_URL || 'http://localhost:3000';
