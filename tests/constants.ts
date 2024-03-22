import Arweave from 'arweave';

import { SmartWeaveSortKey } from '../src/utils';

export const arweave = Arweave.init({
  host: 'arweave.net',
  protocol: 'https',
  port: 443,
});
export const gatewayAddress = '1H7WZIWhzwTH9FIcnuMqYkTsoyv1OTfGa_amvuYwrgo';
export const testDomain = 'angela';
export const evaluateToBlockHeight = 1377100;
export const evaluateToSortKey = new SmartWeaveSortKey(
  '000001376946,0000000000000,18d52956c8e13ae1f557b4e67f6f298b8ffd2a5cd96e42ec24ca649b7401510f',
);
export const localCacheUrl =
  process.env.REMOTE_CACHE_URL || 'http://localhost:3000';
