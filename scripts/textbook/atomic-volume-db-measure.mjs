// scripts/textbook/atomic-volume-db-measure.mjs
// Prints atomic-volume-db-measure.sql with fresh ed25519 keys injected (postgres cannot generate them).
// The SQL is rollback-only; run its output through the DB connector or psql.
import { generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'

let sql = readFileSync(new URL('./atomic-volume-db-measure.sql', import.meta.url), 'utf8')
for (const name of ['GOLD', 'SEED']) {
  const pair = generateKeyPairSync('ed25519')
  const publicKey = pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
  const seed = pair.privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32)
  for (const [marker, value] of [[`decode('__${name}_PUBLIC__'`, publicKey], [`decode('__${name}_SECRET__'`, Buffer.concat([seed, publicKey])]]) {
    if (sql.split(marker).length !== 2) throw Error(`${marker} must appear once`)
    sql = sql.replace(marker, `decode('${value.toString('hex')}'`)
  }
}
if (!sql.trimEnd().endsWith('ROLLBACK;')) throw Error('measurement must end in ROLLBACK')
process.stdout.write(sql)
