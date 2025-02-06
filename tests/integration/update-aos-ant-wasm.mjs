import { AOS_MODULE_ID } from '@ar.io/sdk';
import * as fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

async function main() {
  const fixtures = fs.readdirSync(path.join(__dirname, 'fixtures'));
  const aosAntFiles = fixtures.filter(
    (file) => file.startsWith('aos-ant-') && file.endsWith('.wasm'),
  );

  for (const file of aosAntFiles) {
    if (!file.includes(AOS_MODULE_ID)) {
      fs.unlinkSync(path.join(__dirname, 'fixtures', file));
    }
  }

  if (!aosAntFiles.some((file) => file.includes(AOS_MODULE_ID))) {
    const res = await fetch(`https://arweave.net/${AOS_MODULE_ID}`).then((r) =>
      r.text(),
    );

    fs.writeFileSync(
      path.join(__dirname, 'fixtures', `aos-ant-${AOS_MODULE_ID}.wasm`),
      res,
    );
  }
}

main();
