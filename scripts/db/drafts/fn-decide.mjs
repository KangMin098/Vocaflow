// review 60 판정 제안 — 사람이 확정한다. 근거: fn-review-facts.json + 호출부 client 추적 + 공개 라우트(lib/auth/protected-routes.ts: /library · /comics 공개, /text · /wordvault · /diagnostic 로그인).
import fs from 'node:fs'
const [IN, OUT_MD, OUT_JSON] = process.argv.slice(2)
const facts = JSON.parse(fs.readFileSync(IN, 'utf8'))
const AR = 'AUTH_READ_RPC'   // 로그인만 요구 · 본인 데이터 아님(공용 콘텐츠 · 사전) — 사용자 5등급에 더한 등급
const P = 'PUBLIC_RPC', SELF = 'AUTH_SELF_RPC', REV = 'REVIEWER_RPC', ADM = 'ADMIN_RPC', SVC = 'SERVICE_ONLY'
const PURE = '부작용 없는 순수/사전 조회 보조 함수 — SECURITY INVOKER 상위(공개 조회 함수)가 호출자 권한으로 부르므로 상위와 같은 대상에 열려 있어야 한다'
// name(+argc) → [class, intended caller, 근거, 본문 수정 필요]
const D = {
  _extract_composite_score: [P, '공개 어휘 조회의 하위 계산', PURE],
  acp_classify_license: [P, '라이선스 게이트 하위 순수 함수', '판정(2026-10-06 증거): trg_acp_license_gate 가 library_articles 쓰기 주체 권한으로 돈다 — app/admin/compose/actions.ts 가 관리자 **사용자 세션**으로 library_articles 를 발행한다. 데이터 접근 없는 순수 함수라 공개 무해'],
  acp_article_rollup: [ADM, '관리자 ACP 커버리지 화면', 'admin-queries.ts(requireAdmin 뒤 · 사용자 세션 client 경로 있음). 발행분 집계 수치만'],
  analyze_and_apply_comprehensive_diagnostic_result: [SELF, '진단을 마친 본인(/diagnostic 로그인 화면 브라우저)', 'DiagnosticClient.tsx 브라우저 호출', '본인 검사 없음 — 아무 로그인 사용자가 타인 p_result_id 로 남의 user_profiles 레벨을 덮을 수 있다. auth.uid() = 결과 소유자 검사 추가'],
  analyze_and_apply_diagnostic_result: [SELF, '진단 본인', 'DiagnosticClient.tsx', '같음 — 소유자 검사 추가'],
  analyze_and_apply_track_diagnostic_result: [SELF, '진단 본인', 'DiagnosticClient.tsx', '같음 — 소유자 검사 추가'],
  apply_topic_categories: [SVC, '관리자 API 뒤 서비스 client', 'api/topic-corpus/promote: requireAdminApi → createTopicCorpusClient()=createAdminClient'],
  auto_curate_book: [SVC, 'LCP 처리 라우트(서비스 키)', 'api/lcp/process: serviceKey client'],
  auto_promote_v_level_for_user: [SELF, '학습자 본인(WordVault 허브)', 'VLevelPromotionCheck.tsx 브라우저 · 내부에서 update_user_v_level 로 레벨 쓰기', '본인 검사 없음 + 지금 anon 도 실행 가능 — 비로그인 누구나 임의 user 레벨을 올릴 수 있다. p_user_id = auth.uid() 강제'],
  calc_v_level: [P, '사전 레벨 계산(공개 조회 하위 · 스크립트)', 'calc_skill_level(invoker, anon 실행) 하위 · 읽기 전용'],
  claim_topic_corpus_batch: [SVC, '관리자 API 뒤 서비스 client', 'topic-corpus/drain → createAdminClient'],
  collect_archaic_candidates: [SVC, 'LCP 처리(서비스 키)', 'api/lcp/(dev-)process serviceKey'],
  compute_article_syntax: [SVC, 'ACP 처리(서비스 키 · 스크립트)', 'api/acp/dev-process serviceKey · scripts/acp/* service · 상위 commit_article_analysis 는 이미 service 전용'],
  compute_article_vrl: [SVC, 'ACP 처리', '같음'],
  compute_book_cefrj: [SVC, '배치', '상위 bulk_compute_cefrj_for_all_sources(초안에서 service 전용) 만 부른다'],
  compute_frequency_tier: [P, '트리거 하위 계산', 'auto_compute_freq_fields(트리거, invoker) 하위 순수 함수 — 트리거는 DML 주체 권한으로 돈다'],
  compute_syntax_score: [P, '구문 점수 하위 계산', 'compute_article_syntax/compute_book_syntax 하위 순수 함수. 상위를 SERVICE 로 닫으면 이것도 SERVICE 로 내려도 된다(2단계)'],
  content_gate_publishable: [ADM, '관리자 세션 또는 JWT 없는 서비스/트리거', '판정: compose/actions.ts(관리자 세션) 발행 → trg_la_publish_word_set → publish_article_word_set(invoker) → 이 함수. authenticated 필요 · 본문은 관리자 또는 JWT 없음만 통과시켜야 한다'],
  csat_ec_round_create: [ADM, '관리자(검수 회차 생성)', '5인자판은 4인자판(is_admin 검사)을 부른다 · 스모크는 관리자 JWT'],
  csat_ec_submit_adjudication: [SVC, '호환 보존(앱 호출부 없음)', '판정: 앱 호출부 0 · 스크립트도 smoke.mjs(구 스모크) 뿐 — 사용자 규칙대로 삭제하지 않고 anon/authenticated 회수 후 보존'],
  csat_ec_submit_blind: [SVC, '호환 보존(앱 호출부 없음)', '판정: 앱 호출부 0 · smoke-pilot.mjs 의 「기존 8인자 호환」 확인 2건뿐 — 회수 후 그 확인을 「authenticated 거부」로 바꾼다', '스모크: smoke-pilot.mjs 8인자 호환 2건 → 거부 기대로'],
  csat_source_inventory_live: [SVC, '관리자 화면 서버(서비스 client)', 'source-live.ts 는 admin/csat/sources page·route(service) 에서만 실행 · 브라우저는 타입 import 뿐'],
  csat_source_live_rollup: [SVC, '같음', '같음'],
  csat_source_pipeline_live: [SVC, '같음', '같음'],
  effective_confidence: [P, '복습 일정 계산 하위', 'calculate_next_review_due(invoker) 하위 순수 함수'],
  en_inflection_bases: [P, '사전 조회 하위', 'lookup_word_meaning · resolve_dict_headword 등 공개 사전 조회(invoker) 하위 · 사전 읽기만'],
  enqueue_topic_corpus_docs: [SVC, '관리자 API 뒤 서비스 client', 'topic-corpus/enqueue → createAdminClient'],
  extract_vocabulary_for_user: [SELF, '본인(읽기 화면 서버)', 'chapter-words-queries ← /text/[id] layout(사용자 세션)', 'p_user_id 임의 지정 가능 + anon 실행 가능 — 타인 레벨 · 단어장 정보를 읽는다. auth.uid() 로 고정'],
  extract_vocabulary_for_user_v2: [SELF, '본인(추출 패널 브라우저)', 'ExtractionPanel.tsx', '같음'],
  get_comic_format: [AR, '로그인 학습자(/text/[id]/comic)', '/text 로그인 필수 · 발행 만화 메타'],
  infer_form_pos: [P, '어휘 조회 하위', 'select_*_vocab(invoker) 하위 순수 함수'],
  ingest_topic_corpus_doc: [SVC, '서비스(코퍼스 수집)', 'harvest.ts · local-corpus.ts — 앱 내 importer 없음, 스크립트 service'],
  list_book_comic_catalog: [P, '비로그인 /comics 카탈로그', 'comic/catalog.ts ← /comics/adapted(공개)'],
  list_book_support_vocab: [P, '비로그인 /library 책 상세', 'BookSupportVocabPanel(공개 책 상세) · 사전 해석 읽기만'],
  list_comic_catalog: [P, '비로그인 /comics', 'comic/catalog.ts'],
  list_pd_comic_shelf: [P, '비로그인 /comics/restored', 'pd-comic/queries.ts'],
  list_pd_comics: [P, '비로그인 /comics · sitemap(anon 키)', 'pd-comic/queries.ts · seo/content-entries(anon)'],
  lookup_word_meaning: [P, '비로그인 /library 책 읽기 · 만화 리더', 'reader-queries ← /library/books/[bookId](공개) · ComicReader'],
  pgmq_archive: [SVC, 'LCP 처리(서비스 키)', 'api/lcp/process serviceKey · 임의 큐 메시지 보관(삭제) 가능 — anon 실행 중'],
  preview_book_comic: [P, '비로그인 /comics 미리보기', '서버 하드캡 5컷 · 발행 게이트'],
  publish_article_word_set: [ADM, '관리자 세션 또는 JWT 없는 서비스/트리거', '판정: 위와 같은 경로(관리자 세션 기사 발행 트리거)'],
  publish_book_word_sets: [SVC, '서비스(도서 발행 트리거)', '판정: library_books 쓰기 주체 전수(앱 9곳)가 서비스 키 — 관리자 세션 쓰기 없음. 세션 쓰기가 생기면 트리거가 42501 로 닫힌 채 실패(안전 방향)'],
  recommend_word_sets_for_user: [SELF, '본인(진단 완료 로그인 사용자)', '판정: library/vocab page · hub-query 모두 user 존재 + 진단 완료일 때 자기 user.id 로만 부른다', 'p_user_id 임의 + anon 실행 — auth.uid() 고정'],
  record_pending_words: [SELF, '본인(추출 패널)', 'ExtractionPanel.tsx 브라우저', 'p_user_id 임의 지정 쓰기 — auth.uid() 고정'],
  refresh_user_known_word_count: [SELF, '본인(SRS flush 서버 액션)', 'srs/flush-actions.ts 사용자 세션', 'p_user_id 임의 지정 쓰기 — auth.uid() 고정'],
  release_topic_corpus_claim: [SVC, '관리자 API 뒤 서비스 client', 'topic-corpus/drain → createAdminClient'],
  resolve_dict_headword: [P, '사전 조회 하위', 'select_*_vocab · unresolved_dict_words · textfit(공개/학습자 조회) 하위 · 읽기만'],
  select_book_chapter_vocab: [SVC, '서비스(도서 발행 · 스크립트)', 'publish_book_word_sets 하위 + scripts service — 위 판정을 따른다'],
  select_book_comic: [AR, '로그인 학습자(/text/[id]/comic)', '/text 로그인 필수 · 발행 만화 내용(본인 데이터 아님)'],
  select_book_comic_all: [AR, '로그인 학습자(/text/[id]/comic)', '판정: 비로그인 경로의 호출은 catalog.ts 폴백 두 곳뿐(preview_book_comic · list_comic_catalog 실패 시) — 직접 호출하면 5컷 미리보기 상한을 우회해 전권이 나간다. anon 회수 + 폴백 제거(앱 변경)', '앱: lib/comic/catalog.ts 의 anon 폴백 2곳 제거'],
  select_pd_comic: [P, '비로그인 /comics/restored/[slug]', 'pd-comic/queries.ts'],
  select_pd_comic_info: [P, '비로그인 정보 팝업', 'api/comics/pd/[slug]/info(사용자 세션 · 공개 경로)'],
  store_content_chunk: [SVC, '서비스(본문 저장)', '함수 주석이 「service_role 전용」 · 앱 importer 없음'],
  surface_variants: [P, '사전 조회 하위', 'lookup_word_meaning(공개) 하위 순수 함수'],
  textbook_curriculum_vocab_counts: [P, '비로그인 /library/textbooks', 'shelf-query.ts ← /library/textbooks(공개) · 개수만'],
  textbook_shelf_inventory: [P, '비로그인 /library/textbooks', '같음 · 개수만'],
  textbook_shelf_refreshed_at: [SVC, '서버(서비스)', 'csat/item-count ← textbook/freedom-load(service) 뿐 — 시각 하나라 노출 위험은 낮다'],
  textbook_shelf_sources: [P, '비로그인 /library/textbooks', 'shelf-query.ts · 개수만'],
  textfit_resolve_levels: [AR, '로그인 학습자(추출 패널)', 'textfit/queries ← ExtractionPanel(/text 로그인) · 사전 읽기만'],
  unresolved_dict_words: [AR, '로그인 학습자 · 관리자 · 스크립트', 'ExtractionPanel(로그인) · admin pending-words(관리자 세션) · scripts service · 사전 읽기만'],
}
const target = {
  [AR]: { PUBLIC: 'n', anon: 'n', authenticated: 'Y', service_role: 'Y' },
  [P]: { PUBLIC: 'n', anon: 'Y', authenticated: 'Y', service_role: 'Y' },
  [SELF]: { PUBLIC: 'n', anon: 'n', authenticated: 'Y', service_role: 'Y' },
  [REV]: { PUBLIC: 'n', anon: 'n', authenticated: 'Y(+본문 검수자 배정 검사)', service_role: 'Y' },
  [ADM]: { PUBLIC: 'n', anon: 'n', authenticated: 'Y(+본문 is_admin 검사)', service_role: 'Y' },
  [SVC]: { PUBLIC: 'n', anon: 'n', authenticated: 'n', service_role: 'Y' },
}
// 본문 정규식이 못 잡는 간접 쓰기(다른 definer 함수를 불러 쓴다) — DB 로 확인한 것만
const INDIRECT_WRITE = new Set(['auto_promote_v_level_for_user'])   // update_user_v_level 호출 · auth.uid 없음 · anon 실행(2026-10-06 실측)
const rows = facts.map(f => {
  const d = D[f.name]; if (!d) throw new Error('미판정: ' + f.name)
  const [cls, caller, why, fix0] = d
  let fix = fix0
  const cur = Object.fromEntries(f.priv.split(' ').map(x => x.split('=')))
  const cmap = { PUBLIC: cur.PUBLIC, anon: cur.anon, authenticated: cur.auth, service_role: cur.svc }
  const t = target[cls]
  const diff = Object.keys(t).filter(k => (t[k].startsWith('Y') ? 'Y' : 'n') !== cmap[k]).map(k => `${k} ${cmap[k]}→${t[k][0]}`)
  const bodyCheckMissing = (cls === ADM || cls === REV) && !/is_admin|검수자|위임|4인자판/.test(why) && !f.head.match(/is_admin|auth\.uid/)
  // ADMIN/REVIEWER 는 GRANT 로 authenticated 와 같다 — 본문 검사가 없으면 앱의 requireAdmin 은 직접 RPC 호출을 막지 못한다
  if (bodyCheckMissing && !fix) fix = `본문 ${cls === ADM ? 'is_admin' : '검수자 배정'} 검사 없음 — 로그인 사용자 누구나 직접 RPC 로 부른다. 검사 추가 또는 SERVICE_ONLY 로 내림`
  return { name: f.name, sig: `${f.name}(${f.args})`, oid: f.oid, cls, caller, why, fix: fix || '', secdef: f.secdef, writes: f.writes, user_data: f.user_data,
    side_effect: f.writes ? `쓰기: ${f.tables.slice(0, 4).join(', ')}` : '없음(읽기)', current: cmap, target: t, diff, priority: (f.secdef && (f.writes || INDIRECT_WRITE.has(f.name)) && (cmap.PUBLIC === 'Y' || cmap.anon === 'Y')) ? 'P0' : (fix ? 'P1' : (diff.length ? 'P2' : '—')), comment: f.comment }
})
fs.writeFileSync(OUT_JSON, JSON.stringify(rows, null, 1))
const order = { P0: 0, P1: 1, P2: 2, '—': 3 }
rows.sort((a, b) => order[a.priority] - order[b.priority] || a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name))
const cnt = (k, v) => rows.filter(r => r[k] === v).length
let md = `# 함수 권한 판정표 — review 60 (제안 · 사람이 확정)

> 2026-10-06 작성. 감사 보고서 \`function-execute-audit-2026-10-05.md\` 의 review 60개. **기준은 「지금 누가 부를 수 있나」가 아니라 「설계상 누가 불러야 하나」.**
> 판정 근거: DB 실측(pg_proc · has_function_privilege) + 호출부 client 추적(서비스 키 / 사용자 세션 / 브라우저, \`lib/*\` 는 한 단계 위 importer 까지) + 공개 라우트(\`lib/auth/protected-routes.ts\`: \`/library\` · \`/comics\` 비로그인 공개, \`/text\` · \`/wordvault\` · \`/diagnostic\` 로그인).
> 아직 아무 권한도 바꾸지 않았다. 확정 칸을 채운 뒤 allowlist 매니페스트와 마이그레이션 초안을 다시 만든다.

## 등급

| 등급 | 뜻 | 목표 권한 |
|---|---|---|
| PUBLIC_RPC | 비로그인 공개 화면 · 공개 조회의 하위 순수 함수 | anon · authenticated · service_role (PUBLIC 은 명시 회수) |
| AUTH_SELF_RPC | 로그인 사용자 본인 데이터 | authenticated · service_role + **본문 본인 검사** |
| REVIEWER_RPC | 배정된 검수자 | authenticated · service_role + 본문 배정 검사 (DB 역할로는 구분 불가 — 본문이 지킨다) |
| ADMIN_RPC | 관리자 | authenticated · service_role + 본문 is_admin 검사 |
| SERVICE_ONLY | 배치 · 큐 · 유지보수 · 서비스 키 경로 | service_role 만 |

PostgreSQL 역할은 anon / authenticated / service_role 셋뿐이라 REVIEWER · ADMIN 은 **GRANT 로는 authenticated 와 같고 본문 검사가 실제 경계**다. 그래서 그 등급에서 본문 검사가 없으면 판정표에 「본문 수정」으로 적었다.

## 요약

| 등급 | 수 |
|---|---|
${[P, AR, SELF, REV, ADM, SVC].map(c => `| ${c} | ${cnt('cls', c)} |`).join('\n')}

| 우선순위 | 기준 | 수 |
|---|---|---|
| P0 | SECURITY DEFINER + 쓰기 + PUBLIC/anon 실행 가능 | ${cnt('priority', 'P0')} |
| P1 | 본문 수정 필요(본인 · 관리자 검사 없음 등) | ${cnt('priority', 'P1')} |
| P2 | 권한 차이만 | ${cnt('priority', 'P2')} |
| — | 현재 = 목표 | ${cnt('priority', '—')} |

**GRANT 만으로 닫히지 않는 것(P1)**: \`p_user_id\` · \`p_result_id\` 를 받는 SECURITY DEFINER 학습자 함수들은 본인 검사가 없어 authenticated 로 좁혀도 **로그인 사용자가 남의 데이터를 읽고 쓴다**. 권한 마이그레이션과 별도로 본문 수정 마이그레이션이 필요하다 — 특히 \`auto_promote_v_level_for_user\` 는 지금 anon 도 실행 가능해 비로그인 누구나 임의 사용자의 V-Level 을 올릴 수 있다.

## 판정표

| 우선 | 함수 (OID) | 제안 등급 | 설계상 호출자 | 정의자/쓰기 | 학습자 데이터 | 부작용 | 현재 P/anon/auth/svc | 목표 | 차이 | 근거 | 본문 수정 | 확정 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
`
for (const r of rows) {
  const c = r.current, t = r.target
  md += `| ${r.priority} | \`${r.sig.replace(/\|/g, '/')}\` (${r.oid}) | ${r.cls} | ${r.caller} | ${r.secdef ? 'DEFINER' : 'invoker'}/${r.writes ? '쓰기' : '읽기'} | ${r.user_data ? '예' : '아니오'} | ${r.side_effect} | ${c.PUBLIC}/${c.anon}/${c.authenticated}/${c.service_role} | ${t.PUBLIC}/${t.anon[0]}/${t.authenticated[0]}/${t.service_role[0]} | ${r.diff.join(' · ') || '없음'} | ${r.why.replace(/\|/g, '/')} | ${r.fix.replace(/\|/g, '/') || '—'} | ☐ |\n`
}
md += `
## 확정 전에 볼 것 (판정에 영향)

- **트리거 하위 함수**(\`acp_classify_license\` · \`compute_frequency_tier\` · \`publish_*_word_set\` · \`content_gate_publishable\`): 트리거는 그 행을 쓰는 역할의 권한으로 돈다. \`library_articles\` · \`library_books\` 를 관리자 **사용자 세션**으로 고치는 화면이 있으면 그 하위 함수는 authenticated 가 필요하다. 지금 판정은 그 가능성을 남겨 둔 쪽(ADMIN/PUBLIC)이다.
- **\`select_book_comic_all\`**: 공개 \`/comics/adapted/[bookId]\` 가 전 컷을 받는다 — 미리보기 함수의 5컷 하드캡과 정책이 충돌한다. 의도면 PUBLIC 유지, 아니면 SELF.
- **\`recommend_word_sets_for_user\`**: \`/library/vocab\` 는 공개 경로라 비로그인 렌더가 있다 — 앱이 비로그인일 때 이 RPC 를 부르지 않는지 확인해야 SELF 로 닫을 수 있다.
- **csat_ec 구판 overload 2개**(8인자 \`submit_blind\` · \`submit_adjudication\`): 호출자가 스모크뿐 — 유지할지 제거할지.
- 다음 게이트(사용자 지정 순서): 60 확정 · 미분류 0 → live 대비 intended diff → \`review.mjs\` 전체 → 권한 마이그레이션 + 롤백(PUBLIC 명시 회수 → 필요한 역할만 GRANT) → 격리 PG 권한 매트릭스 → 실제 Supabase anon/authenticated/service_role 스모크 계획.
`
fs.writeFileSync(OUT_MD, md)
console.log({ cls: Object.fromEntries([P, AR, SELF, REV, ADM, SVC].map(c => [c, cnt('cls', c)])), pri: Object.fromEntries(['P0', 'P1', 'P2', '—'].map(p => [p, cnt('priority', p)])) })
