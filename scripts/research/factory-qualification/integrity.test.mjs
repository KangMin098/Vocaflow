// scripts/research/factory-qualification/integrity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha,checkBinding,privateLeaks,references} from './integrity.mjs';
test('changed content cannot pass its frozen hash',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'fq1-integrity-'));fs.writeFileSync(path.join(root,'asset.json'),'first');assert.equal(checkBinding(root,'asset.json',sha('first')).ok,true);fs.writeFileSync(path.join(root,'asset.json'),'changed');assert.equal(checkBinding(root,'asset.json',sha('first')).ok,false);});
test('outside root path and missing asset cannot pass',()=>{assert.equal(checkBinding(process.cwd(),'../external',sha('x')).ok,false);assert.equal(checkBinding(process.cwd(),'nonexistent-file',sha('x')).ok,false);});
test('private original and answer fields are rejected',()=>{assert.deepEqual(privateLeaks({x:{sentences:['source'],answer_key:{position:2}}}),['$.x.sentences','$.x.answer_key']);assert.deepEqual(privateLeaks({answer:2,choices:['a']}),['$.answer','$.choices']);});
test('metadata labels and aggregates do not masquerade as original payload',()=>{assert.deepEqual(privateLeaks({payload_fields:['sentences'],answer_fields:['original'],source_sha256:sha('x'),counts:{pass:4}}),[]);});
test('nested supplied path hashes are collected without inferring missing seals',()=>{assert.deepEqual(references({inputs:[{path:'x',sha256:sha('x')}],other:{path:'unsealed'}}),[{file:'x',hash:sha('x')}]);});
