// docs/platform-goals/step3/build-step3.mjs
// STEP 3 산출물 생성기 — `_raw/` 의 조사 원자료(대응표 · 증거 3영역 · 마이그레이션 이름 대조 · 보안 advisor 요약)를
// 산출물 6종으로 합친다. 다시 실행해도 같은 결과(원자료가 같으면). 판단(갭·DAG)은 아래 표에 근거 item_id 와 함께 적혀 있다.
//   node docs/platform-goals/step3/build-step3.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const RAW = path.join(DIR, '_raw')
const BASE = 'f8e0ffb4aaefaa5656a2f71aaf372af33c32d15c'
const MEASURED = '2026-10-09'
const read = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'))
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')

const cw = read('crosswalk.json')
const areas = ['content_and_auth', 'learning_loop', 'db_ci_deploy_supply'].map((a) => ({ area: a, ...read(`${a}.json`) }))
const mig = read('migration_name_diff.json')
const adv = read('security_advisors_summary.json')

// ── 이 세션이 직접 확인한 추가 증거(원자료 파일에 있다) ──
const own = [
  { item_id: 'X-01', goal_id: 'VG-L3-D1-01', source_ref: 'supabase_migrations.schema_migrations(name) vs git ls-tree f8e0ffb4a supabase/migrations', baseline_sha: 'f8e0ffb4a', owner: 'DB/migrations', reported_or_verified: 'verified', implementation_status: 'DISCONNECTED', pass_fail_skip: 'fail', evidence_path: '_raw/migration_name_diff.json', finding: `이름 기준 대조: 저장소 ${mig.repo_unique}개 · DB ${mig.db_unique}개(행 ${mig.db_rows}) · 일치 ${mig.both} · 저장소만 ${mig.only_repo.length}(_pending 3 포함) · DB 만 ${mig.only_db_count}. 버전 번호 기준(일치 138)보다 실제 차이가 훨씬 작다 — 대부분은 MCP 적용 때 번호가 바뀐 것.`, blocker: 'DB 에만 있는 234개 중 최근 것(reading_promotion·knowledge·csat_ec)은 main 밖 브랜치 산출 — main 만으로 DB 재현 불가', dependency: ['D-01', 'D-02'], r0_priority: 'R0_REQUIRED' },
  { item_id: 'X-02', goal_id: 'VG-L3-D2-02', source_ref: 'supabase get_advisors(security) 전량 540건', baseline_sha: 'f8e0ffb4a', owner: 'DB/security', reported_or_verified: 'verified', implementation_status: 'PARTIAL', pass_fail_skip: 'fail', evidence_path: '_raw/security_advisors_summary.json', finding: `ERROR 0 · anon 실행 가능 SECURITY DEFINER 함수 ${adv.by_level_name['WARN anon_security_definer_function_executable'] ?? 0} · authenticated ${adv.by_level_name['WARN authenticated_security_definer_function_executable'] ?? 0} · 유출 비밀번호 보호 꺼짐 · RLS 켜짐·정책 없음 ${adv.by_level_name['INFO rls_enabled_no_policy'] ?? 0}(INFO).`, blocker: '중등 학습자 계정 보안 — anon definer 21 개별 판정 필요', dependency: [], r0_priority: 'R0_REQUIRED' },
]
own.push({ item_id: 'X-03', goal_id: 'VG-L3-D1-02', source_ref: 'Vocaflow-AI-Control verification/goal-check (VG-L3-D1-02-AC1 FAIL 기록) · T-0006(리텐션 패널만 분리)', baseline_sha: 'f8e0ffb4a', owner: 'analytics', reported_or_verified: 'reported', implementation_status: 'PARTIAL', pass_fail_skip: 'fail', evidence_path: 'AI-Control goal-check 기록 · apps/web/src/lib/admin/account-classification', finding: 'QA·개발·운영 계정 분리는 리텐션 패널에만 적용됐다(T-0006). 대시보드 KPI·사용자 수·퍼널은 내부 계정을 섞어 센다는 FAIL 기록이 있다 — 이번 단계에서 화면별로 다시 세지는 않았다.', blocker: '나머지 지표의 분리 여부 화면별 재확인 필요', dependency: [], r0_priority: 'R0_REQUIRED' })

// ── Codex 독립 검토 r1 반영: 과장된 판정 정정(근거는 Codex 가 짚은 코드 위치 · STEP3_REVIEW_DECISIONS.md) ──
const corrections = {
  'C-01': { finding: '/text·/hub·/practice 등 학습 모듈은 로그인 필요다. 그러나 비로그인 방문자도 /library 기사 화면에서 기사 전문·출처·라이선스·어휘 미리보기를 본다 — 「읽기 체험」은 있고, 없는 것은 체험 안의 Practice·기록이다(Codex r1 #8).', blocker: '비로그인 체험에 학습 루프(Practice·기록)가 없다' },
  'C-06': { finding: '익명 인증(anonymous sign-in)·guest 기록과 가입 시 활동 이관 코드는 찾지 못했다. 가입 화면 주석은 14일 상용 체험에 관한 것이라 「익명 체험 전무」의 근거는 아니다(Codex r1 #8).' },
  'C-03': { finding: '공개 가능 자료는 B2·C1 이 다수이고 A2 는 기사 3·도서 4, B1 은 기사 약 36·도서 약 58 이다. 분포만으로 R0 여정 1개에 쓸 초기·독립 평가 자료가 부족하다고 단정할 수는 없다 — 선별 가능성 확인이 필요하다(Codex r1 #14). 고전 PD 퇴출 방침과 published 상태의 불일치는 사실이다.', implementation_status: 'PARTIAL', pass_fail_skip: 'unknown' },
  'C-09': { finding: '로그인 사용자의 / 진입은 /hub 로, 비로그인 사용자의 보호 경로 진입은 next 파라미터와 함께 /login 으로 보낸다(Codex r1 #17 — 앞선 「return」 표기 정정). 정지 계정 차단. e2e 미실행.' },
  'L-02': { implementation_status: 'UNKNOWN', pass_fail_skip: 'unknown', finding: 'texts completed 0. 미사용(가입 4)인지 완료 버튼 노출 조건(책 장 문맥) 때문인지 구분하지 못했다 — 단절로 확정하지 않는다(Codex r1 #12).' },
  'D-05': { implementation_status: 'BLOCKED', finding: 'deploy.yml 에는 실제 Vercel 배포 단계와 배포 후 sitemap 스모크가 있다. main 실행은 VERCEL_TOKEN·PROJECT_ID 미설정으로 건너뛰었다(skip ≠ pass). 다른 배포 경로(Vercel 대시보드 연결 등) 존재 여부는 확인하지 않았다(Codex r1 #11).' },
  'D-09': { finding: 'admin 밖 직접 표 이름 참조: library_articles 7 · shared_word_sets 5 · pd_comic_issues 13(주로 운영 API). 그러나 /comics/adapted 는 만화 카탈로그 RPC 를, 교재 화면은 ComponentVideo 로 영상을 쓴다 — 표 이름 0 이 소비 0 은 아니다(Codex r1 #10). 동결 판단은 RPC·컴포넌트 경유 소비를 포함해 다시 본다.', implementation_status: 'UNKNOWN' },
  'D-10': { finding: 'GitHub Actions·pg_cron 에 ACP 수집 일정이 없다. 외부 스케줄러(로컬 작업 스케줄러 등)는 확인하지 않아 「수동 실행만」 이라고 단정하지 않는다(Codex r1 #17).', implementation_status: 'UNKNOWN' },
}
const items = [...areas.flatMap((a) => a.items.map((i) => ({ ...i, area: a.area }))), ...own.map((i) => ({ ...i, area: 'step3_session' }))].map((i) => (corrections[i.item_id] ? { ...i, ...corrections[i.item_id], corrected_by: 'codex-review-r1' } : i))
const byId = Object.fromEntries(items.map((i) => [i.item_id, i]))
// 증거 항목 → 정본 기준(조사 영역별 임시 goal_id 를 정본 id 로 잇는다 · Codex r1 #7)
const ITEM_CANON = {
  'C-01': ['VG-L3-B1-01-AC1'], 'C-02': ['VG-L3-C1-02-AC1'], 'C-03': ['VG-L3-A2-01-AC1', 'VG-L3-C1-02-AC1'], 'C-04': ['VG-L3-C1-01-AC1'], 'C-05': ['VG-L3-C1-01-AC1'], 'C-06': ['VG-L3-B1-01-AC1', 'VG-L3-D2-02-AC1'], 'C-07': ['VG-L3-D2-02-AC1'], 'C-08': ['VG-L3-D2-02-AC1'], 'C-09': ['VG-L3-B1-01-AC1'],
  'L-01': ['VG-L3-A2-01-AC1'], 'L-02': ['VG-L3-A2-01-AC1', 'VG-L3-D1-01-AC1'], 'L-03': ['VG-L3-D1-01-AC1', 'VG-L2-D1-AC1'], 'L-04': ['VG-L2-A2-AC1'], 'L-05': ['VG-L2-A2-AC1'], 'L-06': ['VG-L3-A3-01-AC1', 'VG-L3-A3-02-AC1'], 'L-07': ['VG-L3-B2-01-AC1'], 'L-08': ['VG-L2-B2-AC1', 'VG-L3-B2-02-AC1'],
  'D-01': ['VG-L3-D1-01-AC1'], 'D-02': ['VG-L3-D1-01-AC1'], 'D-03': ['VG-L3-D1-01-AC1'], 'D-04': ['VG-L3-D2-01-AC1'], 'D-05': ['VG-L3-D2-01-AC1'], 'D-06': ['VG-L2-D2-AC1'], 'D-07': ['VG-L3-D2-02-AC1'], 'D-08': ['VG-L3-C2-02-AC1'], 'D-09': ['VG-L3-C2-02-AC1'], 'D-10': ['VG-L3-C2-02-AC1'],
  'X-01': ['VG-L3-D1-01-AC1'], 'X-02': ['VG-L3-D2-02-AC1'], 'X-03': ['VG-L3-D1-02-AC1'],
}
for (const i of items) i.canon_criteria = ITEM_CANON[i.item_id] || []

// ── R0 갭 등록부 (근거 item 필수) ──
const gaps = [
  { id: 'R0-G01', step: '비로그인 체험', title: '비로그인 읽기(기사 전문)는 되지만 체험 안에 Practice·결과 기록이 없다', evidence: ['C-01', 'C-06'], severity: 'BLOCKER', minimal_fix: '기존 /library 기사 화면에 확인 1~3문항을 붙이고 결과는 기기 로컬에 둔다(서버 쓰기 없음) — 새 체험 표면을 만들지 않는다', owner: 'web/auth', external: null },
  { id: 'R0-G02', step: '가입 시 기록 연결', title: '익명 체험 → 가입 시 기록 연결 미구현', evidence: ['C-06'], severity: 'BLOCKER', minimal_fix: '가입 직후 로컬 체험 결과를 동의 확인 뒤 1회 이관(멱등 · 본인 계정만 · 다른 계정 이관 거부)', owner: 'web/auth', external: null, depends: ['R0-G01', 'R0-G03', 'R0-G16'] },
  { id: 'R0-G15', step: '목표·수준 선택', title: '최소 목표·수준 선택과 첫 과제 추천(불확실성 처리 포함)이 실행 단위에 없다', evidence: ['C-01'], severity: 'BLOCKER', minimal_fix: '정본 A1-01 R0 조건만: 수준 1회 확인(TextFit 재사용) → 첫 지문 추천 · 진단이 불확실하면 그렇게 표시 — 공용·CSAT 목표 모델 통합은 하지 않는다', owner: 'learning model', external: null, depends: ['R0-G04'], note: '대응표 G5.3 R0_REQUIRED 가 갭 등록부에서 빠졌던 것(Codex r1 #3)' },
  { id: 'R0-G16', step: '가입(보안·동의)', title: '보안 게이트 세부 실행 단위 없음 — 세션 고정·다른 계정 기록 이관 거부·기록 삭제/정정·접근성(완료 버튼 32px < 44px)', evidence: ['C-07', 'C-08', 'X-02'], severity: 'BLOCKER', minimal_fix: '정본 R0 보안 게이트 항목을 각각 시험 단위로 만든다 · 완료 버튼 터치 영역 44px', owner: 'web/auth+a11y', external: null, depends: ['R0-G03'], note: 'Codex r1 #2' },
  { id: 'R0-G17', step: '기록 신뢰', title: '여정 이벤트·기록 계약 없음 — 안정 시도 id·중복 제거·피드백 연결·쓰기 실패 복구 · 점수 저장 helper 가 insert 오류를 버린다', evidence: ['L-03', 'L-04'], severity: 'BLOCKER', minimal_fix: '읽기→Practice→복습→전이 단계를 같은 attempt/session id 로 잇고, 쓰기 실패를 사용자에게 드러내며 재시도 · 이벤트는 events.ts + DB CHECK 둘 다', owner: 'learning records', external: null, note: 'Codex r1 #5 — read_completed 하나로는 사슬이 안 된다' },
  { id: 'R0-G18', step: 'Practice·피드백', title: 'ScriptQuiz: 문항 없는 지문이면 예시(Gatsby) 세션을 띄우면서 요청 textId 로 점수를 저장하려 한다 — 지문별 기록 오염', evidence: [], severity: 'HIGH', minimal_fix: '문항 없으면 예시 세션을 「연습용·기록 안 함」 으로 분리하거나 저장 차단', owner: 'learning modules', external: null, note: 'Codex r1 #1 · apps/web/src/app/(main)/scriptquiz/play/page.tsx:68 — 실제 결함 후보(재현 테스트는 STEP 4)' },
  { id: 'R0-G03', step: '가입(보안·동의)', title: '만 14세 미만 법정대리인 동의·연령 확인 없음 · 동의 기록이 auth 메타데이터 임시 저장', evidence: ['C-07'], severity: 'BLOCKER', minimal_fix: '연령 확인 + 14세 미만 보호자 동의 정책을 먼저 결정하고(법무·사용자), user_consents 표로 이관', owner: 'legal+web/auth', external: '정책·법무 결정(사용자)' },
  { id: 'R0-G04', step: '읽기(콘텐츠)', title: 'R0 여정용 A2~B1 지문의 선별 가능성 미확인(분포상 저난도가 적다) · 고전 PD 퇴출 방침과 published 상태 불일치', evidence: ['C-02', 'C-03', 'C-04', 'C-05'], severity: 'HIGH', minimal_fix: '기존 published·KR 안전 자료에서 초기 과제·독립 평가용 A2~B1 지문을 실제로 골라 본다(신규 양산 아님) · CC-BY-ND 는 가공 없는 원문 표시로 한정', owner: 'library curation', external: null },
  { id: 'R0-G05', step: '읽기 완료', title: '읽기 완료 기록 0건 — 미사용인지 경로 조건(책 장 문맥) 때문인지 미구분 · 일반 읽기 이벤트 0', evidence: ['L-01', 'L-02', 'L-03'], severity: 'BLOCKER', minimal_fix: '완료 버튼 도달 조건 재현 → 단독 지문에도 완료 경로 · 완료 이벤트는 R0-G17 계약으로', owner: 'library/workspace', external: null, depends: ['R0-G17'] },
  { id: 'R0-G06', step: 'Practice·피드백', title: '지문 범위 Practice 는 일부 있다(Flashcard·WordBlitz 링크 · ScriptQuiz 지문 범위) — 읽기 완료 직후 다음 행동으로 이어지는지와 피드백 기록 연결이 미확인', evidence: ['L-04', 'L-07'], severity: 'HIGH', minimal_fix: '읽기 완료 화면에서 같은 지문 Practice 1세트를 다음 행동으로 제시하고 결과를 R0-G17 계약으로 기록(기존 모듈 재사용)', owner: 'learning modules', external: null, depends: ['R0-G05', 'R0-G18'] },
  { id: 'R0-G07', step: '복습', title: '읽기 완료 → FSRS 복습 예약 호출 그래프 미확인', evidence: ['L-05'], severity: 'HIGH', minimal_fix: '완료·Practice 결과가 복습 큐에 들어가는 호출 경로를 확인하고 없으면 연결', owner: 'srs', external: null, depends: ['R0-G06'] },
  { id: 'R0-G08', step: '미노출 전이·재평가', title: '일반 독해용 전이·재평가 경로 없음(CSAT 전용으로만 존재)', evidence: ['L-06', 'L-07'], severity: 'BLOCKER', minimal_fix: 'CSAT 학습 지도의 전이·재평가 계약을 일반 독해에 일반화하되 수용 조건을 명시: ① 전이 지문은 학습·Practice 에 노출되지 않은 지문 ② 시작 전 기준선 수집 ③ 기준선과 비교 가능한 조건(길이·난도·문항 유형) ④ 표본이 적으면 「판정 불가」 로 불확실성 표시 — 새 체계를 만들지 않는다', owner: 'learning model', external: null, depends: ['R0-G04', 'R0-G05', 'R0-G07', 'R0-G15'], note: 'Codex r1 #4' },
  { id: 'R0-G09', step: '학습 이력', title: '대시보드의 데이터 원천·R0 활동 반영 미확인', evidence: ['L-04', 'L-08'], severity: 'HIGH', minimal_fix: 'R0 단계(읽기·Practice·복습·전이·재평가) 기록이 대시보드에 보이는지 확인·연결', owner: 'dashboard', external: null, depends: ['R0-G05', 'R0-G07', 'R0-G08'] },
  { id: 'R0-G10', step: '출시 품질', title: 'e2e 가 저장소 시크릿 미설정으로 건너뛴다(skip ≠ pass)', evidence: ['D-04'], severity: 'BLOCKER', minimal_fix: '전용 테스트 프로젝트·계정 시크릿 설정(사용자) → R0 핵심 e2e skip 0(여정 완성 뒤 그 여정을 시험)', owner: 'CI', external: '저장소 시크릿(사용자)' },
  { id: 'R0-G11', step: '출시 품질', title: 'main 배포 실행이 건너뛰어진다(deploy.yml 에 Vercel 배포·sitemap 스모크는 있음 — 시크릿 미설정) · 다른 배포 경로 미확인', evidence: ['D-05'], severity: 'BLOCKER', minimal_fix: '실제 운영 배포 경로가 있는지 사용자 확인 → 없으면 Vercel 연결 · 배포 후 R0 스모크', owner: 'Deploy', external: 'Vercel 연결·운영 배포 경로 확인(사용자)' },
  { id: 'R0-G12', step: '플랫폼 정합', title: 'main 만으로 DB 를 재현할 수 없다(DB 에만 있는 마이그레이션 234 · 저장소에만 35)', evidence: ['D-01', 'D-02', 'D-03', 'X-01'], severity: 'HIGH', minimal_fix: 'R0 경로가 쓰는 표·함수부터 이름 대조표로 정리 — DB 만 있는 것은 출처 브랜치 확인 후 main 반영 여부 결정(쓰기는 사용자 승인)', owner: 'DB/migrations', external: null },
  { id: 'R0-G13', step: '지표 신뢰', title: 'QA·합성 데이터 분리(VG-L3-D1-02)가 리텐션 패널에만 있다 — 나머지 지표는 기존 FAIL 기록(이번에 화면별 재확인 안 함)', evidence: ['X-03'], severity: 'HIGH', minimal_fix: '리텐션 패널(T-0006) 방식으로 R0 지표 산출에 user_type 분리 적용 · 먼저 화면별 혼입 여부 확인', owner: 'analytics', external: null, note: '대응표에서 이 기준을 다루는 후보 0 (Codex r1 #15 — 근거 항목 X-03 추가)' },
  { id: 'R0-G14', step: '보안', title: '익명 실행 가능 SECURITY DEFINER 21 · 유출 비밀번호 보호 꺼짐', evidence: ['X-02'], severity: 'HIGH', minimal_fix: 'R0 경로에 닿는 함수부터 anon 실행 권한 판정·회수(마이그레이션은 사용자 승인) · Auth 설정에서 유출 비밀번호 보호 켜기(사용자)', owner: 'DB/security', external: 'Auth 설정(사용자)' },
]

// 출시 게이트 — 여정·필수 게이트가 모두 끝나야 e2e/배포 스모크가 R0 를 시험할 수 있다(Codex r1 #6)
gaps.push({ id: 'R0-GATE', step: '출시 게이트', title: 'R0 출시 게이트: 여정 전 단계 + 보안·동의 게이트 + 핵심 e2e skip 0 + 배포 후 스모크 + 강의·게임 없이 완결(VG-L3-A2-02)', evidence: [], severity: 'GATE', minimal_fix: '아래 의존 노드가 모두 끝난 뒤 같은 커밋에서 e2e·스모크 실행 id 를 기록', owner: 'release', external: null, depends: gaps.map((x) => x.id) })

// 대응표 범위 정정(Codex r1 #13): 후보 구현 전체가 아니라 R0 에 필요한 계약만 필수
const CW_OVERRIDE = {
  'G3.3': { r0_priority: 'R0_SUPPORT', note: 'CSAT 구현 자체는 R1 — 전이·재평가 계약만 R0-G08 에서 일반화해 재사용' },
  'L3-05': { r0_priority: 'R0_SUPPORT', note: 'CSAT 문항 한정 판정 — 일반 독해 판정은 R0-G08' },
  'G5.3': { note: 'R0 필수 범위는 최소 목표·수준 선택과 첫 과제 추천(R0-G15)뿐 — 공용·CSAT 목표 모델 통합은 R0 밖' },
  'G2.2': { r0_priority: 'R0_SUPPORT', note: '어휘 Practice·복습 계약만 R0(G06·G07) — 게임 묶음은 선택' },
  'G2.6': { note: 'DEFERRED 유지 — 단 정본 A2-02 는 「강의·게임 없이 R0 완결」 증명을 요구하므로 R0-GATE 조건' },
}
const CAND_GAPS = {
  'G1.1': ['R0-G01'], 'G1.2': ['R0-G17', 'R0-G13'], 'G1.3': ['R0-G15'], 'L3-06': ['R0-G15'], 'L3-09': ['R0-G01', 'R0-G02', 'R0-G03', 'R0-G16'],
  'G2': ['R0-G05', 'R0-G06', 'R0-G07'], 'G2.1': ['R0-G05'], 'L3-01': ['R0-G05', 'R0-G17'], 'L4-02': ['R0-G05'], 'G2.2': ['R0-G06', 'R0-G07'], 'G2.4': ['R0-G06', 'R0-G18'], 'G2.5': ['R0-G07', 'R0-G09'],
  'G3.3': ['R0-G08'], 'L3-05': ['R0-G08'], 'G5': ['R0-G09'], 'G5.3': ['R0-G15'], 'G4.1': ['R0-G04'], 'G4.2': ['R0-G04'],
  'G7': ['R0-G10', 'R0-G11', 'R0-G12'], 'G7.1': ['R0-G12'], 'L4-03': ['R0-G12'], 'G7.3': ['R0-G10', 'R0-G11'], 'L4-05': ['R0-G11'], 'G8.3': ['R0-G14'], 'G2.6': ['R0-GATE'],
}
const CAND_ITEMS = {}
for (const [gid, list] of Object.entries(CAND_GAPS)) CAND_ITEMS[gid] = [...new Set(list.flatMap((g) => gaps.find((x) => x.id === g)?.evidence || []))]

const deferred = [
  { scope: '시험 특화(CSAT·학평)', candidates: ['L0-B', 'G3', 'G3.1', 'G3.2', 'G5.1', 'L3-04', 'L4-04'], note: 'R1. 단, G3.3 전이·재평가 계약은 R0-G08 에서 일반화해 재사용' },
  { scope: '교실·교사', candidates: ['L0-C', 'G6', 'G6.1', 'L3-07'], note: '첫 완결 학습 여정 이후' },
  { scope: '결제·가격', candidates: ['G10', 'G10.1', 'L3-08'], note: '정본 기준 없음(OUT_OF_SCOPE_CANON) · 장기 목표에서 삭제하지 않음' },
  { scope: '콘텐츠 양산·만화·영상', candidates: ['G4.4', 'G4.5', 'G4.6', 'G4.7', 'L4-07'], note: '만화는 카탈로그 RPC(/comics/adapted)·영상은 ComponentVideo 로 학습자 화면이 소비한다(D-09 정정) — 동결은 그 의존을 본 뒤, 삭제 아님. pg_cron 공급 작업 의존도 확인(D-08)' },
  { scope: '강의·듣기 확장', candidates: ['G2.6'], note: '정본: 강의 없이 R0 완결' },
]

// ── 1. CROSSWALK.csv ──
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const crossRows = cw.rows.map((r) => {
  const o = CW_OVERRIDE[r.candidate_id] || {}
  return ['candidate', r.candidate_id, r.candidate_level, r.candidate_title, r.candidate_status_step1, r.canon_criteria.join(' '), r.relation, o.r0_priority || r.r0_priority, r.duplicate_of ?? '', (CAND_GAPS[r.candidate_id] || []).join(' '), (CAND_ITEMS[r.candidate_id] || []).join(' '), `${r.rationale}${o.note ? ` · [codex-r1] ${o.note}` : ''}`, BASE.slice(0, 9), 'reported(STEP1 상태) · 대응=claude', o.r0_priority || o.note ? 'codex-r1' : 'claude']
})
// 갭 → 정본 기준을 명시한다 — 증거 공유로만 추론하면 근거 항목이 다른 기준을 가리키는 갭(G15)·근거 없는 게이트가 추적에서 빠진다(Codex Stop P1)
const GAP_CANON = {
  'R0-G01': ['VG-L3-B1-01-AC1'], 'R0-G02': ['VG-L3-B1-01-AC1', 'VG-L3-D2-02-AC1'], 'R0-G03': ['VG-L3-D2-02-AC1'], 'R0-G04': ['VG-L3-A2-01-AC1', 'VG-L3-C1-02-AC1'],
  'R0-G05': ['VG-L3-A2-01-AC1', 'VG-L3-D1-01-AC1'], 'R0-G06': ['VG-L3-A2-01-AC1', 'VG-L2-A2-AC1'], 'R0-G07': ['VG-L2-A2-AC1'], 'R0-G08': ['VG-L3-A3-01-AC1', 'VG-L3-A3-02-AC1', 'VG-L2-A3-AC1'],
  'R0-G09': ['VG-L2-B2-AC1', 'VG-L3-B2-02-AC1'], 'R0-G10': ['VG-L3-D2-01-AC1'], 'R0-G11': ['VG-L3-D2-01-AC1'], 'R0-G12': ['VG-L3-D1-01-AC1'], 'R0-G13': ['VG-L3-D1-02-AC1'], 'R0-G14': ['VG-L3-D2-02-AC1'],
  'R0-G15': ['VG-L3-A1-01-AC1', 'VG-L2-A1-AC1'], 'R0-G16': ['VG-L3-D2-02-AC1'], 'R0-G17': ['VG-L3-D1-01-AC1', 'VG-L2-D1-AC1'], 'R0-G18': ['VG-L3-A2-01-AC1', 'VG-L3-D1-01-AC1'],
  'R0-GATE': ['VG-L3-A2-02-AC1', 'VG-L3-D2-01-AC1', 'VG-L2-D2-AC1'],
}
for (const x of gaps) {
  x.canon_criteria = GAP_CANON[x.id] || []
  if (!x.canon_criteria.length) throw new Error(`${x.id} 에 정본 기준이 없다 — 추적이 끊긴다`)
}
// 정본 기준 40개 → 후보 · 증거 · 갭 · 상태(근거 없으면 unknown — 통과 아님) (Codex r1 #7)
const critRows = cw.criteria_ids.map((cid) => {
  const cands = cw.rows.filter((r) => r.canon_criteria.includes(cid)).map((r) => r.candidate_id)
  const its = items.filter((i) => i.canon_criteria.includes(cid))
  const gp = gaps.filter((x) => x.canon_criteria.includes(cid))
  const st = !its.length ? 'unknown' : its.some((i) => i.pass_fail_skip === 'fail') ? 'fail' : its.every((i) => i.pass_fail_skip === 'pass') ? 'pass(부분 근거)' : 'unknown'
  return ['criterion', cid, cid.match(/^VG-(L\d)/)?.[1] ?? '', '', '', cid, cands.length ? 'covered_by_candidates' : 'none', '', '', gp.map((x) => x.id).join(' '), its.map((i) => i.item_id).join(' '), `후보 ${cands.join(' ') || '없음'} · 증거 판정 ${st}`, BASE.slice(0, 9), its.length ? its.map((i) => `${i.item_id}:${i.reported_or_verified}`).join(' ') : 'unknown', 'claude+codex-r1']
})
const header = ['row_type', 'id', 'level', 'title', 'step1_status', 'canon_criteria', 'relation', 'r0_priority', 'duplicate_of', 'gap_ids', 'evidence_items', 'rationale', 'baseline_sha', 'reported_or_verified', 'reviewer']
const unmapped = cw.unmapped_criteria.map((u) => ['unmapped_criterion', u.criterion_id, '', '미대응 정본 기준', '', u.criterion_id, 'none', 'UNMAPPED_CRITERION', '', u.criterion_id === 'VG-L3-D1-02-AC1' ? 'R0-G13' : '', u.criterion_id === 'VG-L3-D1-02-AC1' ? 'X-03' : '', u.note, BASE.slice(0, 9), 'claude', ''])
fs.writeFileSync(path.join(DIR, 'STEP3_GOAL_CROSSWALK.csv'), '﻿' + [header, ...crossRows, ...critRows, ...unmapped].map((r) => r.map(esc).join(',')).join('\n') + '\n')

// ── 2. IMPLEMENTATION_INVENTORY.json ──
const statusCount = {}
for (const i of items) statusCount[i.implementation_status] = (statusCount[i.implementation_status] || 0) + 1
fs.writeFileSync(path.join(DIR, 'STEP3_IMPLEMENTATION_INVENTORY.json'), JSON.stringify({ schema: 'vfc-step3-inventory/1', baseline_sha: BASE, measured_at: MEASURED, rule: 'unknown 은 통과가 아니다 · skip 은 pass 가 아니다 · reported = STEP 1 문서 주장 · verified = 이번 단계 직접 재확인', summary: { items: items.length, by_status: statusCount, by_verification: items.reduce((a, i) => ((a[i.reported_or_verified] = (a[i.reported_or_verified] || 0) + 1), a), {}) }, items, migration_name_diff: { repo_unique: mig.repo_unique, db_unique: mig.db_unique, both: mig.both, only_repo: mig.only_repo, only_db_count: mig.only_db_count, only_db_recent_sample: mig.only_db_sample }, security_advisors: { total: adv.total, by_level_name: adv.by_level_name }, limits: areas.flatMap((a) => (a.limits || []).map((l) => `${a.area}: ${l}`)) }, null, 2))

// ── 3. R0_GAP_REGISTER.md ──
const g = (x) => `| ${x.id} | ${x.step} | ${x.title} | ${x.severity} | ${x.canon_criteria.join(' ')} | ${(x.evidence.length ? x.evidence : ['—']).join(' ')} | ${x.minimal_fix} | ${x.external ?? '—'} |`
const reg = [
  '# STEP 3 — R0 갭 등록부',
  '',
  `기준 main \`${BASE.slice(0, 9)}\` · 측정 ${MEASURED} · 정본 v1.1.0. R0 = 중등 일반 영어·독해 · 비로그인 체험→가입→학습 · PC 웹.`,
  '근거 item_id 는 `STEP3_IMPLEMENTATION_INVENTORY.json`. 이 문서는 **분석**이다 — 코드 변경·출시·효과 검증을 완료로 보고하지 않는다.',
  '',
  '## R0 핵심 경로별 차단',
  '',
  '| ID | 단계 | 갭 | 심각도 | 정본 기준 | 근거 | 최소 해결책 | 외부 의존 |',
  '|---|---|---|---|---|---|---|---|',
  ...gaps.map(g),
  '',
  `BLOCKER ${gaps.filter((x) => x.severity === 'BLOCKER').length} · HIGH ${gaps.filter((x) => x.severity === 'HIGH').length}. 외부 의존(사용자만 가능): ${gaps.filter((x) => x.external).map((x) => `${x.id} ${x.external}`).join(' · ')}.`,
  '',
  '## 직접 재현한 사실 vs 보고된 사실',
  '',
  `- 직접 재확인(verified) ${items.filter((i) => i.reported_or_verified === 'verified').length}건 · 미확인(unknown) ${items.filter((i) => i.reported_or_verified === 'unknown').length}건 · STEP 1 보고 인용(reported) ${items.filter((i) => i.reported_or_verified === 'reported').length}건.`,
  '- 화면 실행·e2e 는 이번 단계에서 돌리지 않았다(not_run). 「코드상 도달 가능」은 사용자 경험 검증이 아니다.',
  '- 실제 학습자 검증은 없다(가입 4 · 모두 내부/검증 계정 추정). 합성·AI 시뮬레이션으로 대체하지 않는다.',
  '',
  '## R0 에 필요 없는 것 — 연기(삭제 아님)',
  '',
  '| 범위 | 후보 | 메모 |',
  '|---|---|---|',
  ...deferred.map((d) => `| ${d.scope} | ${d.candidates.join(' ')} | ${d.note} |`),
  '',
  '## STEP 4 로 넘길 실행 단위(순서는 STEP3_DEPENDENCY_DAG.json)',
  '',
  '1. 사용자 결정 3건 먼저: 14세 미만 동의 정책(R0-G03) · 저장소 시크릿/전용 테스트 프로젝트(R0-G10) · Vercel 연결(R0-G11).',
  '2. 결정 없이 바로 가능한 병렬 묶음: 읽기 완료 경로·이벤트(R0-G05) · A2~B1 선반 선별(R0-G04) · 마이그레이션 이름 대조표 정리(R0-G12) · QA 분리(R0-G13) · anon definer 판정(R0-G14).',
  '3. 그 뒤 순차: Practice 연결(G06) → 복습 연결(G07) → 일반 독해 전이·재평가(G08) → 학습 이력(G09) · 체험(G01) → 기록 연결(G02, G03 뒤).',
  '',
]
fs.writeFileSync(path.join(DIR, 'STEP3_R0_GAP_REGISTER.md'), reg.join('\n'))

// ── 4. DEPENDENCY_DAG.json ──
const nodes = gaps.map((x) => ({ id: x.id, step: x.step, title: x.title, severity: x.severity, canon_criteria: x.canon_criteria, external_dependency: x.external, depends_on: x.depends || [] }))
const level = {}
const lv = (id) => (level[id] ??= Math.max(0, ...(nodes.find((n) => n.id === id).depends_on.map((d) => lv(d) + 1))))
nodes.forEach((n) => lv(n.id))
const waves = {}
for (const n of nodes) (waves[level[n.id]] ||= []).push(n.id)
fs.writeFileSync(path.join(DIR, 'STEP3_DEPENDENCY_DAG.json'), JSON.stringify({ schema: 'vfc-step3-dag/1', baseline_sha: BASE, r0_path: ['비로그인 체험', '가입(보안·동의)', '가입 시 기록 연결', '읽기(콘텐츠)', '읽기 완료', 'Practice·피드백', '복습', '미노출 전이·재평가', '학습 이력'], cross_cutting: ['출시 품질', '플랫폼 정합', '지표 신뢰', '보안'], nodes, edges: nodes.flatMap((n) => n.depends_on.map((d) => ({ from: d, to: n.id }))), parallel_waves: waves, user_decisions_first: gaps.filter((x) => x.external).map((x) => x.id), note: '같은 wave 는 서로 의존이 없어 병렬 가능(다른 owner/worktree 일 때). 외부 의존 노드는 사용자 결정 전 구현 착수 금지.' }, null, 2))

// ── 5. EVIDENCE_INDEX.json ──
const rawFiles = fs.readdirSync(RAW).map((f) => ({ path: `docs/platform-goals/step3/_raw/${f}`, sha256: sha(path.join(RAW, f)) }))
// 하드코딩하지 않고 실제로 대조한다(Codex r1 #16)
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'CANON_MANIFEST.json'), 'utf8'))
const manifestText = JSON.stringify(manifest)
const canonFiles = ['PROJECT_GOAL.md', 'PRODUCT_STRATEGY.md', 'GOAL_ACCEPTANCE_CRITERIA.json', 'AI_WORKFLOW_REQUIREMENTS.md', 'STEP3_INPUT_CRITERIA.md'].map((f) => {
  const h = sha(path.join(DIR, '..', f))
  return { path: `docs/platform-goals/${f}`, sha256: h, in_manifest: manifestText.includes(h) }
})
const STEP1 = ['REPOSITORY_INVENTORY.md', 'PLATFORM_FEATURE_INVENTORY.md', 'LEARNING_ENVIRONMENTS.md', 'CONTENT_PIPELINE_ATLAS.md', 'PLATFORM_SHARED_SYSTEMS.md', 'PLATFORM_INTEGRATION_MAP.md', 'GOAL_DECISION_HISTORY.md', 'GOAL_CANDIDATES.md', 'GOAL_HIERARCHY_DRAFT.json', 'PLATFORM_GAP_ANALYSIS.md'].map((f) => {
  const p = path.join(DIR, '..', '..', 'platform-audit', f)
  return { path: `docs/platform-audit/${f}`, present: fs.existsSync(p), sha256: fs.existsSync(p) ? sha(p) : null }
})
if (canonFiles.some((c) => !c.in_manifest)) console.error('경고: 정본 사본 sha256 이 봉인 manifest 와 다르다')
if (STEP1.some((s) => !s.present)) console.error('경고: STEP 1 입력 누락')
fs.writeFileSync(path.join(DIR, 'STEP3_EVIDENCE_INDEX.json'), JSON.stringify({ schema: 'vfc-step3-evidence/1', baseline_main_sha: BASE, audit_branch: 'audit/platform-goal', measured_at: MEASURED, canon: { version: manifest.canon_version, files: canonFiles, manifest_match: canonFiles.every((c) => c.in_manifest) }, step1_inputs: { files: STEP1, missing: STEP1.filter((s) => !s.present).map((s) => s.path) }, raw: rawFiles, sql_run: areas.flatMap((a) => (a.sql_run || []).map((q) => ({ area: a.area, sql: q }))).concat([{ area: 'step3_session', sql: 'select string_agg(name, ...) from supabase_migrations.schema_migrations (이름 709)' }, { area: 'step3_session', sql: 'get_advisors(security) 540건 전량 요약' }]), ci_runs: ['https://github.com/KangMin098/Vocaflow/actions/runs/37888031561', 'https://github.com/KangMin098/Vocaflow/actions/runs/37888031564'], limits: areas.flatMap((a) => (a.limits || []).map((l) => ({ area: a.area, limit: l }))).concat([{ area: 'step3_session', limit: '화면 실행·e2e 미실행 — UI 도달은 코드 근거만' }, { area: 'step3_session', limit: 'DB 만 있는 마이그레이션 234 의 출처 브랜치는 개별 확인하지 않음' }]), privacy: '개인정보 행 없음 — 집계 수치만' }, null, 2))

console.log(JSON.stringify({ crosswalk_rows: crossRows.length, unmapped: unmapped.length, items: items.length, gaps: gaps.length, waves }))
