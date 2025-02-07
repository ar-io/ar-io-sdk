import { AOS_MODULE_ID } from '@ar.io/sdk';
import * as fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const arweaveHost = process.env.ARWEAVE_GATEWAY || 'arweave.net';

async function main() {
  const fixturesDir = path.join(__dirname, '../fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir);
  }
  const fixtures = fs.readdirSync(fixturesDir);
  const aosAntFiles = fixtures.filter(
    (file) => file.startsWith('aos-ant-') && file.endsWith('.wasm'),
  );

  for (const file of aosAntFiles) {
    if (!file.includes(AOS_MODULE_ID)) {
      fs.unlinkSync(path.join(fixturesDir, file));
    }
  }

  if (!aosAntFiles.some((file) => file.includes(AOS_MODULE_ID))) {
    const res = await fetch(`https://${arweaveHost}/${AOS_MODULE_ID}`).then(
      (r) => r.arrayBuffer(),
    );

    fs.writeFileSync(
      path.join(fixturesDir, `aos-ant-${AOS_MODULE_ID}.wasm`),
      Buffer.from(res),
    );
  }
}

main();
