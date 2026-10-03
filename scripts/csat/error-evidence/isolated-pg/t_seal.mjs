// scripts/csat/error-evidence/isolated-pg/t_seal.mjs
// taxonomy 봉인 — draft 수정 가능, 봉인 뒤 INSERT · UPDATE · DELETE 모두 거부, 봉인 해시 = 코드 전체 재계산값
import { as, record } from './lib.mjs'
import { U, learner } from './seed.mjs'

export default async function seal(admin, ctx) {
  const { app, owner } = ctx
  const tryQ = async (sql, params = []) => { try { await owner.query(sql, params); return { ok: true } } catch (e) { return { ok: false, err: e.message } } }
  await owner.query(`insert into public.csat_ec_taxonomy_version (version) values ('v9.3')`)
  const ins = await tryQ(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ('v9.3', 'V.word_sense', 'V', 'l', 'd', 'i', 'e', 'word')`)
  const upd = await tryQ(`update public.csat_ec_code set definition = 'd2', inclusion = 'i2', exclusion = 'e2' where version = 'v9.3'`)
  const ins2 = await tryQ(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ('v9.3', 'S.core', 'S', 'l', 'd', 'i', 'e', 'sentence')`)
  const del = await tryQ(`delete from public.csat_ec_code where version = 'v9.3' and code = 'S.core'`)
  record('봉인', 'draft — 코드 추가 · 정의 수정 · 삭제 가능', ins.ok && upd.ok && ins2.ok && del.ok, [ins.err, upd.err, ins2.err, del.err])
  const s = await as(app, learner(U.ADM), `select public.csat_ec_taxonomy_seal('v9.3') as h`)
  const re = (await admin.query(`select encode(extensions.digest(coalesce(string_agg(to_jsonb(c)::text, chr(10) order by c.code), ''), 'sha256'), 'hex') h from public.csat_ec_code c where version = 'v9.3'`)).rows[0].h
  const stored = (await admin.query(`select definitions_hash, status from public.csat_ec_taxonomy_version where version = 'v9.3'`)).rows[0]
  record('봉인', '봉인 해시 = 코드 전체 별도 재계산값', s.ok && s.rows[0].h === re && stored.definitions_hash === re && stored.status === 'sealed', { returned: s.rows?.[0]?.h?.slice(0, 12), re: re.slice(0, 12) })
  const after = {
    insert: await tryQ(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ('v9.3', 'R.main_idea', 'R', 'l', 'd', 'i', 'e', 'flow')`),
    definition: await tryQ(`update public.csat_ec_code set definition = 'changed' where version = 'v9.3'`),
    inclusion: await tryQ(`update public.csat_ec_code set inclusion = 'changed', exclusion = 'changed' where version = 'v9.3'`),
    rename: await tryQ(`update public.csat_ec_code set code = 'V.renamed' where version = 'v9.3'`),
    move: await tryQ(`update public.csat_ec_code set version = 'v9.0' where version = 'v9.3'`),
    delete: await tryQ(`delete from public.csat_ec_code where version = 'v9.3'`),
    unseal: await tryQ(`update public.csat_ec_taxonomy_version set status = 'draft', sealed_at = null, definitions_hash = null where version = 'v9.3'`),
    rehash: await tryQ(`update public.csat_ec_taxonomy_version set definitions_hash = 'x' where version = 'v9.3'`),
    dropVersion: await tryQ(`delete from public.csat_ec_taxonomy_version where version = 'v9.3'`),
  }
  for (const [k, v] of Object.entries(after)) record('봉인', `봉인 뒤 ${k} 거부(소유자 postgres 로 직접 시도)`, !v.ok, v.err)
  // 다른 draft 버전으로 코드를 옮겨 오는 것도 막는다(봉인된 버전으로 이동)
  await owner.query(`insert into public.csat_ec_taxonomy_version (version) values ('v9.4')`)
  await owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ('v9.4', 'E.option_check', 'E', 'l', 'd', 'i', 'e', 'choice')`)
  const moveIn = await tryQ(`update public.csat_ec_code set version = 'v9.3' where version = 'v9.4'`)
  record('봉인', 'draft 코드를 봉인된 버전으로 옮기기 거부', !moveIn.ok, moveIn.err)
  const newVer = await tryQ(`update public.csat_ec_code set definition = '새 의미' where version = 'v9.4'`)
  record('봉인', '새 의미는 새 버전(draft)에서만 가능', newVer.ok, newVer.err)
}
