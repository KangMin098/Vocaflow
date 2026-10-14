// scripts/research/factory-qualification-v11/integrity.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkBinding,sha,privacyIssues,fileReferences,docLinkIssues,verifySnapshot} from './integrity.mjs';
test('binding rejects tamper, missing file, missing hash and outside root',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fq11-integrity-'));
 fs.writeFileSync(path.join(root,'receipt.json'),'first receipt');
 const expected=sha('first receipt');
 assert.equal(checkBinding(root,'receipt.json',expected).ok,true);
 fs.writeFileSync(path.join(root,'receipt.json'),'later receipt');
 assert.equal(checkBinding(root,'receipt.json',expected).ok,false);
 assert.equal(checkBinding(root,'missing.json',expected).ok,false);
 assert.equal(checkBinding(root,'receipt.json',undefined).ok,false);
 assert.equal(checkBinding(root,undefined,expected).ok,false);
 assert.equal(checkBinding(root,'../outside.json',expected).ok,false);
});
test('metadata IDs and revisions allowed; actual passages, choices, keys and answers refused',()=>{
 assert.deepEqual(privacyIssues({source:{path:'private.json',sha256:'a'.repeat(64)},gold_version:'revision2',case:{id:'synthetic',state:'defect'}}),[]);
 for(const leaked of [{passage:'copyright text'},{choices:['one','two']},{answer_key:{correct:2}},{answer:2},{gold:{full:'actual gold'}},{nested:{response:'actual student answer'}}])assert.ok(privacyIssues(leaked).length);
});
test('schema markers cannot hide private examples',()=>{
 const schema={$schema:'https://json-schema.org/draft/2020-12/schema',properties:{response:{type:'string'}},examples:[{response:'leaked text'}]};
 assert.deepEqual(privacyIssues({$schema:schema.$schema,properties:schema.properties}),[]);
 assert.ok(privacyIssues(schema).some(p=>p.includes('examples')));
});
test('historical path-only and first-review references cannot silently lose hashes',()=>{
 const refs=fileReferences({source:{path:'scripts/research/old.json'},first_review_path:'scripts/research/first.json',first_review_sha256:'a'.repeat(64)});
 assert.equal(refs.length,2);assert.equal(refs.find(r=>r.file.endsWith('old.json')).hash,undefined);assert.equal(refs.find(r=>r.file.endsWith('first.json')).hash,'a'.repeat(64));
});
test('relative document targets and frozen first results remain enforced',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fq11-links-'));
 fs.writeFileSync(path.join(root,'next.md'),'first');
 assert.equal(docLinkIssues(root,'report.md','[next](./next.md)').issues.length,0);
 assert.equal(docLinkIssues(root,'report.md','[missing](./missing.md)').issues.length,1);
 const snapshot={first_seals:[{file:'next.md',sha256:sha('first')}],public_snapshot:[]};
 assert.deepEqual(verifySnapshot(root,snapshot),[]);
 fs.writeFileSync(path.join(root,'next.md'),'changed');
 assert.equal(verifySnapshot(root,snapshot).length,1);
});
