// scripts/research/factory-qualification/public-validation.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {validatePublic} from './public-validation.mjs';
import {validateSpecification,releaseBoundary} from './qualification.mjs';
test('all public metadata and relative doc targets validate with actual result pairs',()=>{assert.equal(validatePublic().contentPairs,20);});
test('source/analysis/Gold version fields are required even for unknown axes',()=>{const p=JSON.parse(fs.readFileSync('docs/research/factory-qualification/data/qualification-results.json','utf8'));delete p.specifications[0].versions.gold;assert.throws(()=>validateSpecification(p.specifications[0]),/context/);});
test('changed evidence binding or product summary cannot hide behind false flags',()=>{const p=JSON.parse(fs.readFileSync('docs/research/factory-qualification/data/qualification-results.json','utf8'));p.results[0].evidence[0].sha256='0'.repeat(64);assert.throws(()=>releaseBoundary(p.specifications[0],p.results[0]),/drift/);});
