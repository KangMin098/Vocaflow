// scripts/csat/source-origin-review.mjs
// 검수한 기존 원천 행만 변경하는 SQL을 만든다. DB 적용은 별도 SQL 실행 도구로 한다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const SHA = /^[a-f0-9]{64}$/
const fields = ['status', 'source_title', 'source_authors', 'source_publisher', 'source_year', 'source_part', 'evidence', 'note', 'audited_at', 'audit_ref']
const literal = value => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`

export function validateReviews(reviews) {
  if (!Array.isArray(reviews) || !reviews.length) throw new Error('A nonempty review array is required')
  const seen = new Set()
  for (const r of reviews) {
    if (!SHA.test(r.passage_sha256) || seen.has(r.passage_sha256)) throw new Error('Invalid or duplicate registry hash')
    seen.add(r.passage_sha256)
    if (!Array.isArray(r.item_ids) || !r.item_ids.length || new Set(r.item_ids).size !== r.item_ids.length || !r.item_ids.includes(r.representative_item_id)) throw new Error('Missing or duplicate item identities')
    if (Object.keys(r.body_sha256_by_item ?? {}).length !== r.item_ids.length || r.item_ids.some(id => !SHA.test(r.body_sha256_by_item[id]))) throw new Error('Every linked item needs a reviewed body hash')
    for (const state of [r.before, r.after]) {
      if (fields.some(f => state?.[f] === undefined)) throw new Error('Incomplete before/after snapshot')
    }
    if (!['confirmed_exact', 'supported_candidate'].includes(r.after.status) || !r.after.source_title || !Array.isArray(r.after.source_authors) || !r.after.source_authors.length || !Array.isArray(r.after.evidence) || !r.after.evidence.length || r.after.evidence.some(e => !/^https?:\/\//.test(e.url ?? ''))) throw new Error('Source review requires bibliography and evidence')
    if (r.after.status === 'supported_candidate') {
      const inference = r.after.evidence.filter(e => e.kind === 'inferred_from_partial')
      const explained = ['distinctive_match', 'content_sequence', 'bibliographic_link', 'checked_scope', 'explained_difference', 'remaining_uncertainty']
      if (!inference.length || inference.some(e => explained.some(key => typeof e[key] !== 'string' || !e[key].trim()))) throw new Error('Inferred review requires specific partial evidence, scope and uncertainty')
    }
    if (isDeepStrictEqual(r.before, r.after)) throw new Error('Review has no change')
  }
  return reviews
}

export function reviewSql(reviews, { commit = false } = {}) {
  validateReviews(reviews)
  const data = literal(reviews)
  let blockTag = '$origin_review$'
  for (let n = 1; data.includes(blockTag); n++) blockTag = `$origin_review_${n}$`
  // JSONB equality on every reviewed field: containment would accept added authors/evidence.
  const snapshot = `jsonb_build_object(${fields.map(f => `'${f}', to_jsonb(o)->'${f}'`).join(', ')})`
  // 기존 판정·연결 문항·현재 본문을 함께 대조하고 적용할 때 행을 잠근다.
  const matching = `o.passage_sha256 = r->>'passage_sha256'
      and o.representative_item_id = r->>'representative_item_id'
      and to_jsonb(o.item_ids) = r->'item_ids'
      and not exists (select 1 from jsonb_each_text(r->'body_sha256_by_item') b
        left join public.csat_items i on i.id=b.key
        where i.id is null or i.passage is null or encode(extensions.digest(convert_to(i.passage, 'UTF8'), 'sha256'), 'hex') <> b.value)`
  if (!commit) return `with reviews as (select value r from jsonb_array_elements(${data}))
select r->>'representative_item_id' item_id,
  case when not coalesce((${matching}), false) then 'body_or_identity_conflict'
       when ${snapshot} = (r->'after') then 'already_applied'
       when ${snapshot} = (r->'before') then 'ready'
       else 'row_conflict' end state
from reviews left join public.knowledge_csat_origins o on o.passage_sha256=r->>'passage_sha256';`
  const assigns = fields.map(f => {
    const value = f === 'evidence' ? `r->'after'->'${f}'`
      : f === 'source_authors' ? `array(select jsonb_array_elements_text(r->'after'->'${f}'))`
      : f === 'source_year' ? `(r->'after'->>'${f}')::integer`
      : f === 'audited_at' ? `(r->'after'->>'${f}')::date`
      : `r->'after'->>'${f}'`
    return `${f}=${value}`
  }).join(',\n      ')
  return `begin;
do ${blockTag}
declare r jsonb; affected integer;
begin
  for r in select value from jsonb_array_elements(${data}) loop
    perform 1 from public.csat_items where id in (select jsonb_object_keys(r->'body_sha256_by_item')) order by id for share;
    perform 1 from public.knowledge_csat_origins where passage_sha256=r->>'passage_sha256' for update;
    if exists (select 1 from public.knowledge_csat_origins o where ${matching} and ${snapshot} = (r->'after')) then continue; end if;
    update public.knowledge_csat_origins o set ${assigns}
    where ${matching} and ${snapshot} = (r->'before');
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Origin review conflict: %', r->>'representative_item_id'; end if;
  end loop;
end ${blockTag};
commit;`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--input')
  if (at < 0 || !process.argv[at + 1]) throw new Error('--input review.json is required')
  const reviews = JSON.parse(fs.readFileSync(process.argv[at + 1], 'utf8')).reviews
  const sql = reviewSql(reviews, { commit: process.argv.includes('--commit-sql') })
  const out = process.argv.indexOf('--output')
  if (out >= 0) fs.writeFileSync(process.argv[out + 1], sql + '\n', 'utf8')
  else console.log(sql)
}
