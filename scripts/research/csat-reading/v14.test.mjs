// scripts/research/csat-reading/v14.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';import {paidUnion,validNecessity,setScore} from './v14-analysis.mjs';
test('stimulus overlapping read body is paid once',()=>assert.equal(paidUnion({units:[{id:'s1',sentence_count:1}]},{used_units:['s1'],stimulus_units:['s1']}).sentences,1));
test('removal changing proposition information cannot prove a necessary relation',()=>assert.equal(validNecessity({necessary:true,test_validity:'valid',changed_other_information:true,preserved_propositions:['p'],disabled_inference:'edge',judgment_without_relation:'different'}),false));
test('intrinsic relation not independently ablated is not proved necessary',()=>assert.equal(validNecessity({necessary:true,test_validity:'not_identifiable',changed_other_information:false,preserved_propositions:['p'],disabled_inference:'edge',judgment_without_relation:'unknown'}),false));
test('validity requires preserved propositions and a specified disabled inference',()=>assert.equal(validNecessity({necessary:true,test_validity:'valid',changed_other_information:false,preserved_propositions:['p'],disabled_inference:'p1→p2',judgment_without_relation:'cannot discriminate under licensed operations'}),true));
test('empty necessity sets are unassessed instead of fabricated perfect agreement',()=>assert.equal(setScore([],[]),null));
test('unknown unit IDs are a source binding problem',()=>assert.deepEqual(paidUnion({units:[]},{used_units:['s9']}).unknown,['s9']));
