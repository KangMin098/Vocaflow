// scripts/db/smoke-function-exec.mjs
//
// G1 · G2 적용 뒤 실제 PostgREST 경로 역할 스모크 — anon 키 · 임시 학습자 JWT · service 키.
// 임시 계정은 이 스크립트가 만들고 끝나면 지운다(실패해도 finally 에서 지운다). 자격 증명은 출력하지 않는다.
// 쓰기 함수는 거부돼야 하는 쪽만 부른다(허용 쪽은 읽기 함수 · 본인 범위 함수만).
// 실행: node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/db/smoke-function-exec.mjs
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(path.resolve('scripts/csat/error-evidence/dev-smoke/package.json'))
const { createClient } = require('@supabase/supabase-js')
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const opt = { auth: { persistSession: false } }
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, opt)
const anon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opt)
const out = []
const rec = (name, pass, detail = '') => { out.push({ name, pass: !!pass, detail }); console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(detail).slice(0, 160) : ''}`) }
const denied = (r) => r.error?.code === '42501'
const ok = (r) => !r.error

let uid = null
try {
  const email = `fx-smoke-${randomUUID().slice(0, 8)}@example.com`, password = randomUUID()
  const cu = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'function exec smoke' } })
  if (cu.error) throw cu.error
  uid = cu.data.user.id
  const me = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opt)
  const si = await me.auth.signInWithPassword({ email, password })
  if (si.error) throw si.error
  const other = (await svc.from('user_profiles').select('user_id').neq('user_id', uid).limit(1)).data?.[0]?.user_id
  const Z = '00000000-0000-0000-0000-000000000000'

  // anon — 공개 제품 흐름은 열려 있고, 그 외는 닫혀 있다
  rec('anon · list_pd_comic_shelf(공개 서가) 허용', ok(await anon.rpc('list_pd_comic_shelf')))
  rec('anon · lookup_word_meaning(공개 사전) 허용', ok(await anon.rpc('lookup_word_meaning', { p_surface: 'running' })))
  rec('anon · library_books 공개 SELECT 허용(정책이 is_admin_or_curator 평가)', ok(await anon.from('library_books').select('id').eq('status', 'published').limit(1)))
  rec('anon · game_leaderboard(공개 순위) 허용', ok(await anon.rpc('game_leaderboard', { p_module: 'wordblitz', p_period: 'week', p_limit: 3 })))
  rec('anon · auto_promote(남) 거부', denied(await anon.rpc('auto_promote_v_level_for_user', { p_user_id: other })))
  rec('anon · select_book_comic_all 거부', denied(await anon.rpc('select_book_comic_all', { p_book_id: Z })))
  rec('anon · recommend_word_sets_for_user 거부', denied(await anon.rpc('recommend_word_sets_for_user', { p_user_id: other, p_interests: null })))

  // 학습자 JWT
  rec('학습자 · auto_promote(남) 거부(G1 본인 검사)', denied(await me.rpc('auto_promote_v_level_for_user', { p_user_id: other })))
  rec('학습자 · auto_promote(자기) 허용', ok(await me.rpc('auto_promote_v_level_for_user', { p_user_id: uid })))
  rec('학습자 · insert_book_analysis 거부(감사 E)', denied(await me.rpc('insert_book_analysis', { p_book_id: Z, p_chapters: [], p_words: [] })))
  rec('학습자 · video_job_restart 거부', denied(await me.rpc('video_job_restart', { p_video_id: '__smoke__', p_kind: 'x' })))
  rec('학습자 · admin_vrl_cron_jobs 거부(본문 관리자 검사)', denied(await me.rpc('admin_vrl_cron_jobs')))
  rec('학습자 · refresh_user_known_word_count(남) 거부', denied(await me.rpc('refresh_user_known_word_count', { p_user_id: other })))
  rec('학습자 · refresh_user_known_word_count(자기) 허용', ok(await me.rpc('refresh_user_known_word_count', { p_user_id: uid })))
  rec('학습자 · list_book_chapter_quiz_catalog(책 퀴즈) 허용', ok(await me.rpc('list_book_chapter_quiz_catalog')))
  rec('학습자 · select_book_comic_all(로그인 만화) 허용', ok(await me.rpc('select_book_comic_all', { p_book_id: Z })))
  rec('학습자 · csat_ec_submit_blind 8인자 구판 거부(G2 회수)', denied(await me.rpc('csat_ec_submit_blind', { p_round: 0, p_session: Z, p_item_no: 1, p_outcome: 'no_cause', p_primary: null, p_contributing: [], p_excluded: [], p_note: 'smoke' })))

  // service
  rec('service · admin_vrl_cron_jobs 허용', ok(await svc.rpc('admin_vrl_cron_jobs')))
  rec('service · topic_corpus_overview 허용', ok(await svc.rpc('topic_corpus_overview')))
} catch (e) {
  rec('스모크 실행', false, e.message)
} finally {
  if (uid) { const d = await svc.auth.admin.deleteUser(uid); rec('임시 계정 정리', !d.error, d.error?.message ?? '') }
  const fail = out.filter((r) => !r.pass).length
  fs.writeFileSync('scripts/db/isolated/results-smoke-function-exec.json', JSON.stringify({ ranAt: new Date().toISOString(), pass: out.length - fail, fail, out }, null, 1))
  console.log(`\n합계 PASS ${out.length - fail} · FAIL ${fail}`)
  process.exitCode = fail ? 1 : 0
}
