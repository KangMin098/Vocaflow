// scripts/lcp/story/s5-reader-harness-eval.ts
//
// T-0176 LCP Story S5 — 학습자 독서 격리 브라우저 하네스의 「서버 쪽」 평가기(tsx 자식 프로세스 · 한 호출 한 프로세스).
// stdin { op: 'page' | 'action', url?, name?, args?, statePath, actor } → stdout { value, rpc_calls }.
//
// 실제(제품 코드 그대로): apps/web/src/lib/library/story/learner.ts 의 loadStoryCatalogPage · loadStoryReaderPage · recordStoryPosition ·
//   completeStoryUnit(+ 그것이 부르는 lib/auth/account · lib/auth/redirect). page.tsx 두 개 · actions.ts 가 하는 배선(쿠키 클라이언트 → loader /
//   함수 · loginUrlWithReturn('/library/stories') · returnPathOf)은 아래에 같은 내용으로 옮겨 적었다 — 그 파일들은 next/headers · 쿠키 클라이언트를
//   끌어와 여기서 import 하지 않는다(page.tsx 의 returnPathOf 는 원문에서 정규식으로 다시 읽어 어긋나면 멈춘다).
// 대역(명시): 쿠키 세션 클라이언트(auth.getUser · user_profiles · rpc)를 아래 FakeLearnerDb 가 받는다. FakeLearnerDb 는
//   supabase/migrations/20261025094450_lcp_story_s3_schema.sql 의 학습자 RPC 5개(story_catalog · story_read_unit · story_record_position ·
//   story_complete_unit · story_my_progress)와 story.require_learner, 그리고 **미적용 제안** story_reader_context
//   (AI-Control runtime/lcp-story-20261025/s5-proposal-forward.sql r3 §B — 반환 jsonb 키 그대로)를 메모리에서 흉내 낸다.
//   reader_context_missing=true 면 story_reader_context 는 PostgREST PGRST202(스키마 캐시에 함수 없음)로 끝난다(S5 적용 전 상태).
//   U1(T-0187): 미적용 제안 story_release_guidance(supabase/migrations/_pending_lcp_story_u1_guidance.sql)도 흉내 낸다 —
//   guidance_missing=true 면 PGRST202(지금 공유 DB 의 실제 상태) · guidance_corrupt 의 발행 키가 이용 가능하면 story:guidance_mismatch.
//   W2(T-0189): 미적용 제안 story_unit_context_notes(supabase/migrations/_pending_lcp_story_w2_context_notes.sql)도 흉내 낸다 —
//   context_notes_missing=true 면 PGRST202 · context_notes_corrupt 는 story:context_notes_mismatch · context_notes_wrong_unit 은 다른 단위 번호 응답.
//   PostgREST · RLS · 잠금 · 트랜잭션 · JWT 는 흉내 내지 않는다. 시각을 읽지 않는다(갱신 순서는 seq 로).
// 'server-only' 는 NODE_OPTIONS=--conditions=react-server 로 빈 모듈이 되게 실행한다(스펙이 그렇게 띄운다).

import fs from 'node:fs'
import path from 'node:path'

import {
  completeStoryUnit,
  loadStoryCatalogPage,
  loadStoryReaderPage,
  loadStoryReturnTarget,
  recordStoryPosition,
  type StoryLearnerClient,
  type StoryLearnerRpcResponse,
} from '../../../apps/web/src/lib/library/story/learner'
import { loginUrlWithReturn } from '../../../apps/web/src/lib/auth/redirect'
import { saveStoryWord, type StoryWordSaveClient } from '../../../apps/web/src/lib/library/story/save-word'
import { resolveVaultReturnContexts, vaultPathWithStoryContext } from '../../../apps/web/src/lib/library/story/return-context'
import { vocabMapLink } from '../../../apps/web/src/lib/csat/map-return'
import type { ReaderDbState } from './s5-reader-fixtures'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Release = ReaderDbState['releases'][number]
type Progress = ReaderDbState['progress'][number]

const REPO = path.resolve(__dirname, '../../..')

class Raise extends Error {
  constructor(public code: string, public pgcode = 'P0001') {
    super(code)
  }
}

export class FakeLearnerDb {
  constructor(public state: ReaderDbState) {}

  private requireLearner(uid: string | null): string {
    if (!uid) throw new Raise('story:auth_required', '42501')
    const status = this.state.profiles[uid]?.status
    if (status === 'suspended' || status === 'deleted') throw new Raise('story:account_blocked', '42501')
    return uid
  }

  private available(r: Release | undefined): r is Release {
    return !!r && r.withdrawn_at === null && r.rights_ok
  }

  private openRelease(key: unknown): Release {
    const r = this.state.releases.find((x) => x.release_key === key && x.withdrawn_at === null)
    if (!r || !r.rights_ok) throw new Raise('story:release_unavailable')
    return r
  }

  private progressOf(uid: string, key: string): Progress | undefined {
    return this.state.progress.find((p) => p.user_id === uid && p.release_key === key)
  }

  private upsertPosition(uid: string, r: Release, idx: number): Progress {
    this.state.seq += 1
    let p = this.progressOf(uid, r.release_key)
    if (!p) {
      p = { user_id: uid, release_key: r.release_key, last_unit_index: idx, furthest_unit_index: idx, completed_units: [], completed_at: null, updated_seq: this.state.seq }
      this.state.progress.push(p)
    } else {
      p.last_unit_index = idx
      p.furthest_unit_index = Math.max(p.furthest_unit_index, idx)
      p.updated_seq = this.state.seq
    }
    return p
  }

  call(fn: string, args: Json, uid: string | null): unknown {
    switch (fn) {
      case 'story_catalog':
        // catalog_hide = 하네스 경합 흉내(읽기 문맥 · 본문 조회 뒤 서가 조회 사이에 철회 · 권리 보류가 끼어든 경우) — 서가에서만 빠진다
        return this.state.releases
          .filter((r) => this.available(r) && !(this.state.catalog_hide ?? []).includes(r.release_key))
          .sort((a, b) => (a.work_key + '\u0000' + a.edition_key < b.work_key + '\u0000' + b.edition_key ? -1 : 1))
          .map((r) => ({
            release_key: r.release_key, work_key: r.work_key, edition_key: r.edition_key, kind: r.kind, coverage: r.coverage, completion_label: r.completion_label,
            title: r.title, hook_text: r.hook_text, unit_count: r.unit_count, target_cefr: r.target_cefr, published_at: r.published_at,
          }))
      case 'story_read_unit': {
        if (!uid) throw new Raise('permission denied for function story_read_unit', '42501')
        this.requireLearner(uid)
        const r = this.openRelease(args.p_release_key)
        const u = r.units.find((x) => x.unit_index === args.p_unit_index)
        if (!u) throw new Raise('story:unit_not_found')
        return [{ release_key: r.release_key, unit_index: u.unit_index, unit_count: r.unit_count, unit_title: u.unit_title, unit_text: u.body }]
      }
      case 'story_record_position': {
        if (!uid) throw new Raise('permission denied for function story_record_position', '42501')
        const me = this.requireLearner(uid)
        const r = this.openRelease(args.p_release_key)
        const idx = args.p_unit_index
        if (typeof idx !== 'number' || idx < 0 || idx >= r.unit_count) throw new Raise('story:unit_not_found')
        const p = this.upsertPosition(me, r, idx)
        return [{ release_key: r.release_key, last_unit_index: p.last_unit_index, furthest_unit_index: p.furthest_unit_index, completed_unit_count: p.completed_units.length, unit_count: r.unit_count, completed: p.completed_at !== null }]
      }
      case 'story_complete_unit': {
        if (!uid) throw new Raise('permission denied for function story_complete_unit', '42501')
        const me = this.requireLearner(uid)
        const r = this.openRelease(args.p_release_key)
        const idx = args.p_unit_index
        if (typeof idx !== 'number' || idx < 0 || idx >= r.unit_count) throw new Raise('story:unit_not_found')
        const p = this.upsertPosition(me, r, idx)
        if (!p.completed_units.includes(idx)) p.completed_units.push(idx)
        p.completed_units.sort((a, b) => a - b)
        if (p.completed_at === null && p.completed_units.length === r.unit_count) p.completed_at = `seq:${this.state.seq}`
        return [{ release_key: r.release_key, unit_index: idx, completed_unit_count: p.completed_units.length, unit_count: r.unit_count, completed: p.completed_at !== null, completion_label: r.completion_label }]
      }
      case 'story_my_progress': {
        if (!uid) throw new Raise('permission denied for function story_my_progress', '42501')
        const me = this.requireLearner(uid)
        return this.state.progress
          .filter((p) => p.user_id === me)
          .sort((a, b) => b.updated_seq - a.updated_seq)
          .map((p) => {
            const r = this.state.releases.find((x) => x.release_key === p.release_key)!
            return {
              release_key: r.release_key, work_key: r.work_key, edition_key: r.edition_key, completion_label: r.completion_label,
              counts_as_work_completion: r.counts_as_work_completion, counts_as_original_text_completion: false,
              last_unit_index: p.last_unit_index, furthest_unit_index: p.furthest_unit_index, completed_unit_count: p.completed_units.length,
              unit_count: r.unit_count, completed_at: p.completed_at === null ? null : '2026-10-25T12:00:00+00:00', release_available: this.available(r),
            }
          })
      }
      case 'story_reader_context': {
        if (this.state.reader_context_missing) throw new Raise('__PGRST202__')
        if (!uid) throw new Raise('permission denied for function story_reader_context', '42501')
        const me = this.requireLearner(uid)
        const r = this.openRelease(args.p_release_key)
        const idx = args.p_unit_index
        if (typeof idx !== 'number' || idx < 0 || idx >= r.unit_count) throw new Raise('story:unit_not_found')
        const u = r.units.find((x) => x.unit_index === idx)
        if (!u) throw new Raise('story:unit_not_found')
        const p = this.progressOf(me, r.release_key)
        return {
          release_key: r.release_key, work_key: r.work_key, edition_key: r.edition_key, kind: r.kind, coverage: r.coverage,
          completion_label: r.completion_label, counts_as_work_completion: r.counts_as_work_completion, counts_as_original_text_completion: false,
          title: r.title, unit_count: r.unit_count,
          progress: p ? { last_unit_index: p.last_unit_index, furthest_unit_index: p.furthest_unit_index, completed_unit_count: p.completed_units.length, completed: p.completed_at !== null } : null,
          toc: r.units.map((x) => ({ unit_index: x.unit_index, unit_title: x.unit_title, completed: !!p && p.completed_units.includes(x.unit_index) })),
          unit: { unit_index: idx, unit_title: u.unit_title, anchors: u.anchors.map((a) => ({ paragraph: a.paragraph, start: a.start, end: a.end, quote: a.quote })), offset_unit: 'utf16_code_unit' },
          source: { ...r.source },
        }
      }
      case 'story_release_guidance': {
        // 미적용 제안 _pending_lcp_story_u1_guidance.sql 의 규칙: anon 포함 · 서가와 같은 이용 가능 범위 · 키 형식 오류 / 불가는 0행 ·
        // 결속 불일치(여기서는 guidance_corrupt 표시 · 발행본 CEFR null)가 하나라도 있으면 호출 전체가 story:guidance_mismatch.
        if (this.state.guidance_missing) throw new Raise('__PGRST202__')
        const key = args.p_release_key ?? null
        if (key !== null && !/^lsr_[0-9a-f]{32}$/.test(String(key))) return []
        const rows = this.state.releases
          .filter((r) => this.available(r) && (key === null || r.release_key === key))
          .sort((a, b) => (a.work_key + '\u0000' + a.edition_key < b.work_key + '\u0000' + b.edition_key ? -1 : 1))
        if (rows.some((r) => (this.state.guidance_corrupt ?? []).includes(r.release_key) || r.target_cefr === null)) {
          throw new Raise('story:guidance_mismatch')
        }
        return rows.map((r) => ({
          release_key: r.release_key,
          target_cefr: r.target_cefr,
          cognitive_demand: r.guidance.cognitive_demand,
          background_load: r.guidance.background_load,
          cautions: [...r.guidance.cautions],
        }))
      }
      case 'story_unit_context_notes': {
        // 미적용 제안 _pending_lcp_story_w2_context_notes.sql 의 규칙: authenticated 만 · 학습자 판정 · 철회 · 권리 보류 → release_unavailable ·
        // 단위 범위 → unit_not_found · 결속 불일치(여기서는 context_notes_corrupt 표시) → story:context_notes_mismatch ·
        // 반환 { release_key, unit_index, notes:[{id,text}] } = 그 단위 id 를 unit_ids 에 가진 설명만(저장 순서 · 문장 그대로).
        if (this.state.context_notes_missing) throw new Raise('__PGRST202__')
        if (!uid) throw new Raise('permission denied for function story_unit_context_notes', '42501')
        this.requireLearner(uid)
        const r = this.openRelease(args.p_release_key)
        const idx = args.p_unit_index
        if (typeof idx !== 'number' || idx < 0 || idx >= r.unit_count) throw new Raise('story:unit_not_found')
        const u = r.units.find((x) => x.unit_index === idx)
        if (!u) throw new Raise('story:unit_not_found')
        if ((this.state.context_notes_corrupt ?? []).includes(r.release_key)) throw new Raise('story:context_notes_mismatch')
        const wrong = (this.state.context_notes_wrong_unit ?? []).includes(r.release_key)
        return {
          release_key: r.release_key,
          unit_index: wrong ? (idx + 1) % r.unit_count : idx,
          notes: (r.context_notes ?? []).filter((n) => n.unit_ids.includes(u.unit_id)).map((n) => ({ id: n.id, text: n.text })),
        }
      }
      case 'lookup_word_meaning': {
        // D5-I01 서버 쪽 사전 재조회 대역(합성 사전). 공유 사전 · DB 없음.
        const surface = String(args.p_surface ?? '')
        const hit = (this.state.dictionary ?? {})[surface.toLowerCase()]
        const base = { surface, v_level: null, word_register: null }
        return [hit ? { ...base, ...hit } : { ...base, found: false, resolved_word: null, meaning_ko: null, pos: null, cefr_level: null, example_en: null, match_via: 'not_found', lang: null }]
      }
      default:
        throw new Raise(`permission denied for function ${fn}`, '42501')
    }
  }

  rpc(fn: string, args: Json, uid: string | null): StoryLearnerRpcResponse {
    const fault = this.state.faults[fn]
    if (fault && fault.times > 0) {
      fault.times -= 1
      this.state.rpc_log.push({ fn, actor: uid, result: fault.kind })
      // supabase-js 는 fetch 실패를 throw 하지 않고 error 객체로 돌려준다
      if (fault.kind === 'network') return { data: null, error: { message: 'TypeError: fetch failed', details: '', hint: '', code: '' } }
      return { data: null, error: { message: fault.message ?? 'canceling statement due to statement timeout', code: '57014', details: null, hint: null } }
    }
    try {
      const data = this.call(fn, args ?? {}, uid)
      this.state.rpc_log.push({ fn, actor: uid, result: 'ok', args: { p_release_key: args?.p_release_key, p_unit_index: args?.p_unit_index } })
      return { data, error: null }
    } catch (e) {
      if (!(e instanceof Raise)) throw e
      if (e.code === '__PGRST202__') {
        this.state.rpc_log.push({ fn, actor: uid, result: 'error', code: 'PGRST202' })
        return {
          data: null,
          error: {
            code: 'PGRST202',
            message: `Could not find the function public.${fn} in the schema cache`,
            details: `Searched for the function public.${fn} with the given parameters or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`,
            hint: null,
          },
        }
      }
      this.state.rpc_log.push({ fn, actor: uid, result: 'error', code: e.code })
      return { data: null, error: { message: e.code, code: e.pgcode, details: null, hint: null } }
    }
  }
}

/**
 * D5-I01 vocabularies 대역(메모리 · 합성). RLS 흉내: 본인(uid) 행만 읽고 본인 user_id 로만 쓴다. UNIQUE(user_id, word) → 23505.
 * faults.vocab_select · vocab_insert 로 조회 실패 · 삽입 실패를 흉내 낸다. 모든 호출은 rpc_log 에 table 로 남는다.
 */
function vocabTable(db: FakeLearnerDb, uid: string | null) {
  const st = db.state as ReaderDbState
  return {
    select: (_cols: string) => {
      const eqs: Array<[string, string]> = []
      const q = {
        eq: (c: string, v: string) => (eqs.push([c, v]), q),
        maybeSingle: async () => {
          const fault = st.faults.vocab_select
          if (fault && fault.times > 0) {
            fault.times -= 1
            st.rpc_log.push({ fn: 'vocabularies.select', actor: uid, result: 'error' })
            return { data: null, error: { message: 'permission denied for table vocabularies', code: '42501' } }
          }
          st.rpc_log.push({ fn: 'vocabularies.select', actor: uid, result: 'ok' })
          const hit = st.vocab.find((r) => r.user_id === uid && eqs.every(([c, v]) => r[c] === v))
          return { data: hit ? { id: hit.id } : null, error: null }
        },
      }
      return q
    },
    insert: async (row: Record<string, unknown>) => {
      const fault = st.faults.vocab_insert
      if (fault && fault.times > 0) {
        fault.times -= 1
        st.rpc_log.push({ fn: 'vocabularies.insert', actor: uid, result: 'error' })
        return { error: { message: 'insert failed (synthetic)', code: 'XX000' } }
      }
      if (!uid || row.user_id !== uid) {
        st.rpc_log.push({ fn: 'vocabularies.insert', actor: uid, result: 'error', code: '42501' })
        return { error: { message: 'new row violates row-level security policy', code: '42501' } }
      }
      if (st.vocab.some((r) => r.user_id === uid && r.word === row.word)) {
        st.rpc_log.push({ fn: 'vocabularies.insert', actor: uid, result: 'error', code: '23505' })
        return { error: { message: 'duplicate key value violates unique constraint', code: '23505' } }
      }
      st.seq += 1
      st.vocab.push({ id: `vocab-${st.seq}`, ...row })
      st.rpc_log.push({ fn: 'vocabularies.insert', actor: uid, result: 'ok' })
      return { error: null }
    },
  }
}

/** 쿠키 세션 클라이언트 대역 — 그 요청의 「로그인 계정」 uid(null = 익명). */
function cookieClient(db: FakeLearnerDb, uid: string | null): StoryLearnerClient {
  return {
    auth: {
      getUser: async () =>
        uid ? { data: { user: { id: uid } }, error: null } : { data: { user: null }, error: { name: 'AuthSessionMissingError', message: 'Auth session missing!', status: 400 } },
    },
    from: (table: string) => {
      if (table === 'vocabularies') return vocabTable(db, uid)
      return {
        select: () => ({
          eq: (_c: string, id: string) => ({
            maybeSingle: async () => {
              const fault = db.state.faults.user_profiles
              if (fault && fault.times > 0) {
                fault.times -= 1
                return { data: null, error: { message: 'TypeError: fetch failed' } }
              }
              const row = db.state.profiles[id]
              return { data: row ? { status: row.status } : null, error: null }
            },
          }),
        }),
      }
    },
    rpc: async (fn, args) => db.rpc(fn, (args ?? {}) as Json, uid),
  }
}

// page.tsx 의 returnPathOf — 원문을 읽어 같은 본문인지 확인한다(옮겨 적은 사본이 어긋나면 멈춘다)
const READER_PAGE = path.join(REPO, 'apps/web/src/app/(main)/library/stories/[releaseKey]/page.tsx')
const RETURN_PATH_SRC = `function returnPathOf(releaseKey: string, unit: string | string[] | undefined): string {
  if (!/^lsr_[0-9a-f]{32}$/.test(releaseKey)) return '/library/stories'
  const base = \`/library/stories/\${releaseKey}\`
  return typeof unit === 'string' && /^(0|[1-9][0-9]{0,3})$/.test(unit) ? \`\${base}?unit=\${unit}\` : base
}`
function returnPathOf(releaseKey: string, unit: string | string[] | undefined): string {
  if (!/^lsr_[0-9a-f]{32}$/.test(releaseKey)) return '/library/stories'
  const base = `/library/stories/${releaseKey}`
  return typeof unit === 'string' && /^(0|[1-9][0-9]{0,3})$/.test(unit) ? `${base}?unit=${unit}` : base
}

export async function runPage(url: string, db: FakeLearnerDb, uid: string | null): Promise<Json> {
  const u = new URL(url, 'http://harness.local')
  const client = cookieClient(db, uid)
  if (u.pathname === '/library/stories') {
    // app/(main)/library/stories/page.tsx
    const state = await loadStoryCatalogPage({ client })
    return { kind: 'catalog', url: u.pathname + u.search, state, loginHref: loginUrlWithReturn('/library/stories') }
  }
  const m = /^\/library\/stories\/([^/]+)$/.exec(u.pathname)
  if (m) {
    // app/(main)/library/stories/[releaseKey]/page.tsx — Next 는 params 를 디코드해 넘긴다. searchParams 는 값이 여럿이면 배열.
    const releaseKey = decodeURIComponent(m[1]!)
    const all = u.searchParams.getAll('unit')
    const unitParam = all.length === 0 ? undefined : all.length === 1 ? all[0] : all
    const state = await loadStoryReaderPage({ client }, { releaseKey, unitParam, returnPath: returnPathOf(releaseKey, unitParam) })
    return { kind: 'reader', url: u.pathname + u.search, state, releaseKey }
  }
  if (u.pathname === '/wordvault/browse') {
    // app/(main)/wordvault/browse/page.tsx(T-0191 계정 경계 시험용) — 같은 순서: 서버 getUser → 없으면 로그인 주소(검증된 Story 문맥만) →
    // resolveVaultReturnContexts(섞이면 둘 다 없음) → Story 공개 메타 → 본인 행만 목록. 화면은 viewerId(= getUser 주인)에 묶인다.
    const sp: Record<string, string | string[]> = {}
    for (const k of new Set(u.searchParams.keys())) {
      const all = u.searchParams.getAll(k)
      sp[k] = all.length === 1 ? all[0]! : all
    }
    const { story, mapBack } = resolveVaultReturnContexts(sp)
    if (!uid) return { kind: 'redirect', url: u.pathname + u.search, to: loginUrlWithReturn(vaultPathWithStoryContext(story.status === 'ok' ? story.context : null)) }
    const storyReturn = story.status === 'conflict' ? { status: 'conflict' } : story.status === 'ok' ? await loadStoryReturnTarget({ client }, story.context) : null
    const reopenHref = story.status === 'ok' ? vaultPathWithStoryContext(story.context) : mapBack ? vocabMapLink('/wordvault/browse', mapBack) : '/wordvault/browse'
    const st = db.state as ReaderDbState
    const fault = st.faults.vault_list
    if (fault && fault.times > 0) {
      fault.times -= 1
      return { kind: 'vault', url: u.pathname + u.search, viewerId: uid, failed: true, words: [], mapBack, storyReturn, reopenHref }
    }
    // 본인 행만(RLS 흉내) → BrowseWord 모양(lib/wordvault/browse-queries vocabRowToWord 의 필드 — 그 모듈은 server-only · @/ 별칭이라 여기서 import 하지 않는다).
    // 합성 행은 복습 기록이 없어 srs 를 싣지 않는다(= new) · 시각을 읽지 않는다.
    const words = st.vocab
      .filter((r) => r.user_id === uid)
      .map((r, i) => {
        const cefr = typeof r.cefr_level === 'string' && /^[ABC][12]$/.test(r.cefr_level) ? r.cefr_level : 'B1'
        return { id: i + 1, dbId: r.id, textId: r.text_id ?? null, setId: null, word: r.word, pos: r.pos ?? '', meaning: r.meaning, exampleEn: r.example_sentence ?? '', level: cefr, levelClass: cefr[0]!.toLowerCase(), mastery: 1, lastDays: 0, nextDays: 0 }
      })
    return { kind: 'vault', url: u.pathname + u.search, viewerId: uid, failed: false, words, mapBack, storyReturn, reopenHref }
  }
  return { kind: 'unknown', url: u.pathname }
}

export async function runAction(name: string, args: unknown[], db: FakeLearnerDb, uid: string | null): Promise<unknown> {
  // app/(main)/library/stories/actions.ts
  const client = cookieClient(db, uid)
  switch (name) {
    case 'recordStoryPositionAction': return recordStoryPosition({ client }, args[0])
    case 'completeStoryUnitAction': return completeStoryUnit({ client }, args[0])
    case 'saveStoryWordAction': return saveStoryWord({ client: client as unknown as StoryWordSaveClient }, args[0])
    default: throw new Error(`unknown story action ${name}`)
  }
}

async function main() {
  const pageSrc = fs.readFileSync(READER_PAGE, 'utf8').replace(/\r\n/g, '\n')
  if (!pageSrc.includes(RETURN_PATH_SRC)) throw new Error('[releaseKey]/page.tsx returnPathOf changed — update the harness copy')
  const input = JSON.parse(fs.readFileSync(0, 'utf8')) as { op: 'page' | 'action'; url?: string; name?: string; args?: unknown[]; statePath: string; actor: string | null }
  const state = JSON.parse(fs.readFileSync(input.statePath, 'utf8')) as ReaderDbState
  const before = state.rpc_log.length
  const db = new FakeLearnerDb(state)
  const value = input.op === 'page' ? await runPage(input.url!, db, input.actor) : await runAction(input.name!, input.args ?? [], db, input.actor)
  fs.writeFileSync(input.statePath, JSON.stringify(state))
  process.stdout.write(JSON.stringify({ value, rpc_calls: state.rpc_log.slice(before) }))
}

if (process.argv[1] && /s5-reader-harness-eval\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) void main()
