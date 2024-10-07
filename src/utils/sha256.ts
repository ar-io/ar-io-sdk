import { createHash } from 'crypto';

export function sha256(data: string): string {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}
