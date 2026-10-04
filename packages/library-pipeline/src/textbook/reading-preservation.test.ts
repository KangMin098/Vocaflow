// packages/library-pipeline/src/textbook/reading-preservation.test.ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { validatePreservationPack, validatePreservationChecks } from './reading-preservation'
import { readPreservationRules, preservationForSource, readingTask, validateReadingDraft, digest, READING_SOURCE_COLUMNS, filterAdaptationSourceLevel } from '../../../../scripts/textbook/academic-reading-contract.mjs'
import { quote, analysis, rights, target } from './academic-reading-fixtures'

const reviewFile = new URL('../../../../scripts/textbook/frym-precision/round-1.json',import.meta.url)
const packFile = new URL('../../../../scripts/textbook/frym-precision/preservation-rules-1.json',import.meta.url)
const reviewText = fs.readFileSync(reviewFile,'utf8'), review = JSON.parse(reviewText)
const pack = JSON.parse(fs.readFileSync(packFile,'utf8'))
const task = readPreservationRules(packFile, reviewFile).values().next().value
// Synthetic source: runtime contract tests do not need the ignored original full text.
const current = {
  id: task.entry.source_id, source_id: task.entry.source_key, source:'frym', source_url:task.entry.source_url,
  content:quote, updated_at:'2026-10-01T00:00:00Z', license:'CC-BY-4.0', license_class:'cc_by',
  copyright_safe_in_kr:true, display_only:false, status:'ready', csat_fit:{},
}
const syntheticTask = { ...task, entry: { ...task.entry, source_quote:quote, source_revision:current.updated_at, source_hash:digest(quote) } }
const exported = {
  adapted_from_id:current.id, source_feed:'frym', source_url:current.source_url, source_license:'cc_by',
  target_v_level:3, target_band:'middle', source_text:quote,
  reading:readingTask(current,target,null,syntheticTask),
}
const check = { rule_id:syntheticTask.entry.rules[0].id, verdict:'preserved', passage_quote:quote, reason:'Synthetic passage retains the specified relationship.' }
const row = { ...exported, text:quote, reading:{...exported.reading,
  source_rights:{...rights, canonical_source:'frym', canonical_url:current.source_url, license:current.license},
  reading_analysis:{...analysis, preservation_checks:[check]},
} }
const now = Date.parse('2026-10-04T00:00:00Z')

describe('source/review-bound preservation',()=>{
  it('only validated review scope allows unmeasured VRL; legacy minimum is retained',()=>{
    const calls=[]
    const query={or:(value)=>{calls.push(value);return query},gte:(column,value)=>{calls.push([column,value]);return query}}
    filterAdaptationSourceLevel(query,7,false)
    filterAdaptationSourceLevel(query,0,true)
    expect(calls).toEqual([['article_v_level',7],'article_v_level.is.null,article_v_level.gte.0'])
  })
  it('restricts rules to the four full-text candidates and recorded anchors',()=>{
    expect(validatePreservationPack(pack,review,digest(reviewText)).entries.map(e=>e.pair_id)).toEqual(['F02','F06','F14','F18'])
    expect(()=>validatePreservationPack(pack,review,'0'.repeat(64))).toThrow('hash changed')
    for (const field of ['source_hash','source_revision','source_key','research_hash','research_quote','source_quote','original_work_id']) {
      const bad=structuredClone(pack); bad.entries[0][field] = field.endsWith('hash') ? '0'.repeat(64) : 'wrong source binding'
      expect(()=>validatePreservationPack(bad,review,digest(reviewText))).toThrow()
    }
  })
  it('a later review correction invalidates eligibility even with an updated review hash',()=>{
    const amended=structuredClone(review); amended.pairs.find(p=>p.id==='F02').alignments[0].verdict='partial'
    expect(()=>validatePreservationPack({...pack,review_hash:'a'.repeat(64)},amended,'a'.repeat(64))).toThrow('not an eligible')
  })
  it('duplicate rule/source identities and noncandidate pairs cannot be added',()=>{
    const bad=structuredClone(pack); bad.entries.push(bad.entries[0])
    expect(()=>validatePreservationPack(bad,review,digest(reviewText))).toThrow()
    const duplicate=structuredClone(pack); duplicate.entries[0].rules.push(duplicate.entries[0].rules[0])
    expect(()=>validatePreservationPack(duplicate,review,digest(reviewText))).toThrow()
    const noncandidate=structuredClone(pack); noncandidate.entries[0].pair_id='F10'; noncandidate.entries[0].alignment_id='F10-A1'
    expect(()=>validatePreservationPack(noncandidate,review,digest(reviewText))).toThrow('not an eligible')
  })
  it('both file arguments are necessary and altered rule text changes task identity',()=>{
    expect(()=>readPreservationRules(packFile,null)).toThrow('required together')
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'reading-preservation-'))
    try {
      const file=path.join(temp,'rules.json'), changed=structuredClone(pack)
      changed.entries[0].rules[0].must_preserve += ' Additional observer condition.'
      fs.writeFileSync(file,JSON.stringify(changed))
      expect(readPreservationRules(file,reviewFile).get(current.id).rules_hash).not.toBe(task.rules_hash)
    } finally { fs.unlinkSync(path.join(temp,'rules.json')); fs.rmdirSync(temp) }
  })
  it('the importer projection retains source_id so a valid binding can pass',()=>{
    const projected=Object.fromEntries(READING_SOURCE_COLUMNS.split(',').map(k=>[k.trim(),current[k.trim()]]))
    expect(preservationForSource(projected,new Map([[current.id,syntheticTask]]))).toEqual(syntheticTask)
    expect(validateReadingDraft(row,exported,projected,now,syntheticTask).ok).toBe(true)
    expect(()=>preservationForSource({...projected,source_id:undefined},new Map([[current.id,syntheticTask]]))).toThrow('stale')
  })
  it('current rules are required at import and cannot be removed or replaced in an out chunk',()=>{
    expect(validateReadingDraft(row,exported,current,now).ok).toBe(false)
    expect(validateReadingDraft(row,exported,current,now,{...syntheticTask,rules_hash:'0'.repeat(64)}).ok).toBe(false)
    expect(validateReadingDraft({...row,reading:{...row.reading,preservation_rules:null}},exported,current,now,syntheticTask).ok).toBe(false)
    const result=validateReadingDraft(row,exported,current,now,syntheticTask)
    expect(result.spec?.provenance.preservation_rules).toEqual(syntheticTask)
    expect(result.spec?.state).toBe('awaiting_content_review')
  })
  it.each([
    [], [check,check], [{...check,rule_id:'foreign'}], [{...check,verdict:'changed'}],
    [{...check,verdict:'held',passage_quote:null}], [{...check,passage_quote:'A quote outside the adapted body.'}],
  ])('rejects incomplete, changed, held or unsupported reports: %j',checks=>{
    expect(validatePreservationChecks(syntheticTask,checks,quote)).not.toBeNull()
    expect(validateReadingDraft({...row,reading:{...row.reading,reading_analysis:{...row.reading.reading_analysis,preservation_checks:checks}}},exported,current,now,syntheticTask).ok).toBe(false)
  })
  it('structure checks do not detect a false self-report with a real quote',()=>{
    const falsePassage='Vision is always the most important sense.'
    expect(validatePreservationChecks(syntheticTask,[{...check,passage_quote:falsePassage}],falsePassage)).toBeNull()
    // Pending independent content review is therefore retained; this is not a semantic classifier.
  })
  it('checks cannot be claimed for an export without rules',()=>{
    expect(validatePreservationChecks(null,[check],quote)).toBe('preservation rule coverage mismatch')
    expect(validatePreservationChecks(null,undefined,quote)).toBeNull()
  })
})
