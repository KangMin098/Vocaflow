// scripts/csat/pilot/__tests__/live-tls.test.mjs
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {liveConnectionOptions,loadPg} from '../live.mjs'

test('G6 live options require trusted TLS and preserve an explicit CA',()=>{
  assert.deepEqual(liveConnectionOptions('postgresql://localhost/test',{}).ssl,{rejectUnauthorized:true})
  assert.deepEqual(liveConnectionOptions('postgresql://localhost/test',{SUPABASE_DB_CA_CERT:'test-public-ca'}).ssl,{rejectUnauthorized:true,ca:'test-public-ca'})
})

test('G6 URL options cannot override the actual node-postgres TLS configuration',async()=>{
  const pg=await loadPg()
  for(const query of ['ssl=no-verify','ssl=0','sslmode=disable','sslmode=require&sslrootcert=unused&sslcert=unused&sslkey=unused&uselibpqcompat=true']){
    const client=new pg.Client(liveConnectionOptions('postgresql://test:test@localhost/test?'+query,{SUPABASE_DB_CA_CERT:'test-public-ca'}))
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized,true)
    assert.equal(client.connectionParameters.ssl.ca,'test-public-ca')
  }
})

test('G6 rejects non-PostgreSQL protocols before connecting',()=>{
  assert.throws(()=>liveConnectionOptions('https://example.test',{}),/Invalid PostgreSQL protocol/)
})
