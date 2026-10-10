// scripts/textbook/atomic-production-smoke-prepare.mjs
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';

const smoke = readFileSync(new URL('./atomic-production-db-smoke.sql', import.meta.url), 'utf8');
let sql = smoke;
for (const name of ['gold', 'seed']) {
  const pair = generateKeyPairSync('ed25519');
  const publicKey = pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const seed = pair.privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
  const secretKey = Buffer.concat([seed, publicKey]);
  const marker = `SELECT public,secret INTO v_${name}_public,v_${name}_secret FROM pgsodium.crypto_sign_new_keypair();`;
  if (!sql.includes(marker)) throw new Error(`Missing ${name} keypair marker`);
  sql = sql.replace(marker,
    `SELECT decode('${publicKey.toString('hex')}','hex'),decode('${secretKey.toString('hex')}','hex') INTO v_${name}_public,v_${name}_secret;`);
}
process.stdout.write(sql);
