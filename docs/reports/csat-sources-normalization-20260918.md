# CSAT 원문 정상화 Gate 기록 — 2026-09-18

> 최신 후속 상태는 아래 **2026-09-19 분리 검증**에 기록한다. 9/18 Gate 수치는 당시 측정이며 현재 배포 완료를 뜻하지 않는다.

## 2026-09-19 분리 검증

원본 워크스페이스는 다른 세션이 사용 중이므로 `feat/csat-source-policy-v3` 분리 워크트리에서 작업했다. 서브 에이전트가 판정·적재, API, SQL 리뷰, 설정 진단을 나누어 수행했다.

- 오래된 캐시가 관리자 적격 집계에 남는 문제, 오래된 적재 파일이 최신 캐시를 덮는 문제, 0–100 밖 구문 점수 허용 문제를 수정했다. 캐시 누락도 검사·재검증할 수 있고 현재 판정 미리보기와 저장된 판정을 구분한다.
- 추가 승인 후 `20260918222517_csat_source_cache_freshness.sql` 적용. 활성 원문 timestamp 트리거를 DB에서 확인했으며 `FOR SHARE` 캐시 가드와 live 운영 view를 추가했다.
- rollback 검증 통과: stale revision, 1μs 차이, 이전 측정 거부, 동일 재적재, 누락 캐시, 원문 변경, 정상 복구, 보관 원문 제외, 마지막 excerpt 문항 삭제. 원문·문항·캐시·이력·시도·리뷰 행 수와 원문 전체 값 보존을 확인했다. 두 connection의 동시 경쟁은 MCP 호출에서 재현되지 않아 검증 완료 범위에서 제외한다.
- DB 전수 대조: 후보 **87,716**, 캐시 stale/missing **0**, 운영 view와 `csat_source_is_eligible` 불일치 **0**. 적격 **9,103**, 조건부 **4,296**, review **59,675**, 반려 **14,642**. 잘못된 syntax score **0**.
- 체크포인트 `csat-source-cache-freshness-20260919` before/after 완료. 차이는 bloat 표본 교체와 연결 비율이며 사라진 콘텐츠 축은 없다. `pnpm docs:db-stats` 실행.
- 패키지 **143파일/2,584개**, 웹 관련 **15파일/282개**, 적재·감사 **17개** 통과. web/package 타입 검사 통과. 마지막 코드 수정 후 production build도 lint·typecheck 포함 exit 0, 정적 페이지 **236개** 생성. production 서버 3110에서 개발 우회 환경변수를 켜도 비인증 admin 페이지/연습은 307→로그인, 운영 API는 401임을 확인한 뒤 서버를 종료했다. 분리 환경에서 드러난 기존 날짜 의존 테스트·optional 앵커 타입·도움말 경로 정규식도 최소 수정했다.
- 빌드·dev·브라우저 동시 실행 시 CPU 100%/가용 RAM 약 581MB로 초기 브라우저 검사가 실패했다. 순차 재검증에서 **Playwright 10/10 통과**: 390px 다크·1280px 원문 검사, 1280/1440/1920 첫 행749px, 접근성, 포커스 복원, 캐시 누락의 사용 대기 표시. 실행 로그는 `.agent-logs/e2e-final.log`.
- 별도 REST 실측에서 14개 동시 count 중 **11개가 약 8.7초에 HTTP 500**으로 실패했다. `20260918232551_csat_source_operations_summary.sql`을 **사용자 승인 후 적용**했다. service_role·8초 제한에서 SELECT 검증, 실제 API **3/3 HTTP200**, 초기6037ms·후속1552/1577ms, 14개 수치 일치. 체크포인트 `csat-source-summary-20260919` before/after diff는 bloat 표본 교체·연결 비율 변동만 확인했다.
- SQL 4개 파일명을 실제 DB migration version과 일치시켜 다른 세션의 `20260919100000` 파일과 번호 충돌을 피했다. SQL 실행문은 변경하지 않았으며 재적용하지 않는다.
- 공유 브랜치 `pc2-20260720-1`의 최신 변경을 반영하고 CHANGELOG 양쪽 기록을 보존했다. 미커밋 화면 상태로 생성된 디자인 기준선과 커밋 코드의 불일치는 없는 경로 2개 제거·실제 형태 선언·기록 숫자 한 열 배치로 보완했다. 기준선 상향 없이 관련 회귀 **41개**, 기록 화면 390/1280px의 3행 배치·가로 넘침 없음 확인. 학습 기록 계산·카피·정확도 막대는 보존했다.
- 원본 `.codex/config.toml`의 GENERATED 마커 복구 파일은 `.agent-logs/config-repair`에 준비했다. 격리 설정 검사 9/9, 회귀 7/7 통과. 원본은 다른 세션 잠금이 있어 수정하지 않았으며 활성 설정 복구 완료로 주장하지 않는다.

**최종 통합 검증:** 최신 `pc2-20260720-1` 반영 후 production build exit 0(236페이지), 원격 TypeScript·문서 링크·manifest 검사 3개 통과. 워크플로의 migration 문서/Unreleased 검사는 이번 실행에서 skipped였으며 통과 수에 포함하지 않았다.

**배포 경계:** SQL 4개·최종 코드·DB·브라우저 검증 완료. `feat/csat-source-policy-v3`에 커밋·push하고 [초안 PR #98](https://github.com/KangMin098/Vocaflow/pull/98)을 생성했다(기준 브랜치 `pc2-20260720-1`). main 병합·서비스 배포·원격 일정 감사 활성화는 별도다. 원래 localhost:3000은 다른 세션의 워크트리를 사용하므로 이번 분리 브랜치 화면을 자동 반영하지 않는다.

## Gate 1 — 감사 재현

**상태: PASS**

**확인**: 이전 감사와 동일한 로직으로 현재 DB를 다시 읽었다. 아래 수치는 모두 차이 0이다.

| 측정 | 분모 / 로직 | 이전 = 현재 |
|---|---|---:|
| 전체 | library_articles 메타데이터 전수 | 109,043 |
| 본문 후보 | ready/published | 87,716 |
| reject 적격 모순 | 구 규격 v2 composable 중 library 시 예외 제외 | 319 |
| CEFR 제외 | 구 적격 중 cefrFitsBand=false | 13,287 |
| 발췌창만 보유 | 구 excerpt 중 문항 참조 없음 | 5,610 |
| 품질 후보 | 본문 전수, 7개 규칙 적중의 합집합 | 4,876 |
| VOA 안내문 | 후보 VOA content에 `We have a new comment system` 포함 | 450 |
| 내용 미판정 | 구 judgeSource grade=unjudged | 48,811 |
| 분석 미완 | 구 grade=unknown | 15 |
| 캐시 차이 | 전체 DB − 9/15 재고 캐시 | 90 |

**변경**: DB 없음. 전수 증거는 `.agent-logs/csat-sources-before-normalization.json`,
`csat-sources-defects-before.json`에 보존했다. 본문 검사는 2026-09-18T13:49:32Z 완료.

**검증**: 신규 메타데이터 스캔 종료 0, 본문 87,716편 스캔 종료 0, VOA SQL 450 재현.

**잔여 위험**: 순차 스캔은 트랜잭션 시점 스냅샷이 아니다. 수집·분석 동시 변경은 후속 재조정에서 다시 확인한다.

**다음**: Gate 2 — 단일 판정 계약.

## 판정 결정

- `judgeSource`: 기존 7축 진단. 최종 사용 허용에 직접 사용하지 않는다.
- `evaluateSource`: v3 최종 원문 정책. textbook/learner 문맥을 명시하며 같은 원문 안전 기준을 쓴다.
- CEFR: 기존 `cefrFitsBand`의 V0–4 B1 이하, V5+ B2 이하를 따른다. 기존 조판 정책을 근거로 한다.
- 내용 reject는 raw·library·발췌 예외로 통과하지 않는다. library 시의 읽기 목적과 교재 파생 목적을 구분한다.
- 발췌창은 candidate, 문항 연결은 item-linked. 후자는 조건부이며 범위 승인·문항 품질 통과의 증거가 아니다.
- 본문 heuristic은 검토 큐이며 자동 반려 근거로 쓰지 않는다.
- 원문/판정 원장은 DB. JSON 스냅샷과 신규 eligibility 테이블은 재생성 가능한 파생 캐시다.
- DB 소비자는 v3 캐시의 source_updated_at이 실제 원문 updated_at과 일치할 때만 사용한다.
  원문 갱신 즉시 기존 캐시는 사용 불가가 되며 재평가가 필요하다. 원문·정답·시도 기록은 보존한다.
- 온라인 문항 길이와 인쇄 지면 길이는 소비 문맥별 후속 정책이며 원문 적격 차이로 숨기지 않는다.

## Gate 3 사전 영향 측정

319편에는 DCP 문항 **43,305개**가 연결되어 있다. 현재 시도 기록 0, source_url로 연결한 texts 복사 0.
이것은 열람/과거 인쇄 노출이 0이라는 뜻이 아니다. 과거 조판 기록에는 문항·원문 manifest가 없다.
그중 CEFR도 통과한 3편·285문항은 P0로 별도 추적한다.

| 원문 ID | 연결 문항 |
|---|---:|
| 37302a93-48d3-4259-ba79-45ac33a49f88 | 156 |
| 6f87daee-89da-4e1f-8aab-febb88f448fb | 77 |
| a7ef6583-18f3-4ec0-8659-0e9ebc4c79f9 | 52 |

원문 변경/삭제 없이 사용 경로의 판정을 바로잡는다. 기존 조판 노출은 manifest 부재로 unknown을 유지한다.

## Gate 0 — 구조 조사

**상태: PASS**

**확인:** 수집→분석→내용 게이트→적격→문항→조판/학습자 흐름과 분산 판정을 코드/DB로 확인.
**변경:** [구조 기록](./csat-sources-architecture-20260918.md).
**검증:** SQL 함수 정의·원천 전수 metadata·실제 라우트/소비자 조회.
**잔여 위험:** 과거 교재 manifest 없음.
**다음:** Gate 1 재현(위 기록).

## Gate 2 — 단일 판정 계약

**상태: PASS**

**확인:** raw/library 예외의 reject 우회, 조판에만 적용되던 CEFR, 발췌창/문항 혼동 확인.
**변경:** `evaluateSource` v3의 status/reasons/blockers/warnings 및 analysis/content/CEFR/excerpt/quality 계약.
조판·스캔·감사·관리자는 같은 함수, SQL은 동일 캐시의 규격·revision·blocker를 검증.
**검증:** 기존 판정41+신규 정책17 회귀. `VOCAFLOW_SOURCE_STRICT=0` 우회는 오류.
**잔여 위험:** 원문 통과는 문항별 정답·위치·검수 승인이 아니며 조건부 경고에 명시.
**다음:** Gate 3.

## Gate 3 — 위험도와 영향

**상태: PASS**

**확인:** 원래 문제 집합의 연결 문항 수를 계산했다. 집합은 겹치므로 합산하지 않는다.

| 우선순위/집합 | 원문 | 문항 연결 원문 | 연결 문항 | 처리 |
|---|---:|---:|---:|---|
| P0 구 reject 적격 | 319 | 319 | 43,305 | 동일 조건 전체 차단 |
| P0 구 harmful 적격 | 3 | 3 | 463 | 최종 정책 차단 |
| P1 CEFR 불일치 | 13,287 | 11,550 | 255,295 | 공통 상한 |
| P1 발췌창만 보유 | 5,610 | 0 | 0 | 후보/사용 대기 |
| P2 내용 미판정 | 48,811 | 12,446 | 498,245 | 원인별 검토 |
| P2 분석 미완(수정 전) | 15 | 13 | 217 | 결정론적 12건 복구 |
| P3 개선 후 품질 신호(VOA 포함) | 5,161 | 2,600 | 132,245 | 검토 후보 |
| P4 원천 스냅샷 차이 | 90 | ID별 증거 보존 | ID별 증거 보존 | 캐시 재생성 |

**변경:** inspector에 문항·시도·교재 연결. 새 조판은 원문/문항 ID·규격·시각·HTML 해시를 colophon과 immutable sidecar manifest에 보존.
**검증:** 기존319편의 시도 기록/URL 기반 texts 복사0. P0 3편/285문항 별도 추적(위 표).
**잔여 위험:** 시도0은 읽기/인쇄 노출0을 뜻하지 않는다. 과거 교재 영향 unknown.
**다음:** Gate 4.

## Gate 4 — 반려 우회

**상태: PASS**

**확인:** 구319편뿐 아니라 전체 reject1,056편 확인. 그중334편/43,411문항 연결.
**변경:** reject는 용도 예외보다 먼저 차단. 승인된 SQL2개 및 전체 캐시 적재.
**검증:** reject 중 usable/excerpt0. P0 3편 SQL 적격 false. 실제 반려 문항 채점도 차단.
**잔여 위험:** 기존 파일·인쇄물은 소급 회수하지 않았고 원문/정답 보존.
**다음:** Gate 5.

## Gate 5 — CEFR

**상태: PASS**

**확인:** 기존 교재 `cefrFitsBand` 정책 채택(V0–4 B1 이하, V5+ B2 이하).
**변경:** 관리/조판/학습자 파생 연습에 공통 적용. 독서 입력은 별도 문맥.
**검증:** 적격 중 CEFR 조판 제외13,287→0.
**잔여 위험:** CEFR 자체를 재추정하지 않았으며 상한 초과 값을 임의로 낮추지 않음.
**다음:** Gate 6.

## Gate 6 — 발췌

**상태: PASS**

**확인:** 기존5,610편의 범위는 현재 문장 수 안에 있고 기록된 문장 수도 일치. revision/hash와 문항은 없어 승인 근거 부족.
**변경:** candidate/item-linked 구분. windows만 있으면 `excerpt_not_materialized`, `approved=false`.
**검증:** 적격 중 windows-only5,610→0.
**잔여 위험:** item-linked도 문항별 규격/정답/앵커 검수가 필요.
**다음:** Gate 7.

## Gate 7 — 본문 품질

**상태: PASS (검토 분류·규칙 개선, 본문 일괄 정제 아님)**

**확인:** 본문87,716편 전수. 14개 규칙×원천 층에서 각2건, 28건 검토: true15/false10/uncertain3.
목적 표본이므로 전체 precision 추정치로 일반화하지 않는다. [개별 ID/판단](./csat-source-quality-review-20260918.json).

| 규칙 | true | false | uncertain |
|---|---:|---:|---:|
| 수식/인용 누락 | 2 | 2 | 0 |
| HTML | 2 | 2 | 0 |
| 문단 중복 | 1 | 0 | 3 |
| VOA 댓글 안내 | 2 | 0 | 0 |
| NASA 공유 UI | 2 | 0 | 0 |
| 이야기 경계 | 2 | 2 | 0 |
| 브라우저 안내 | 4 | 0 | 0 |
| 위키 마크업 | 0 | 4 | 0 |

**변경:** 완결 HTML 태그·전체 문단 중복을 검사하고 숫자 인용/음악/수학·말줄임·정상 의문문 오탐 제외.
영향4,669편 재검사, 171행 신호 갱신. 7규칙 합집합4,876→4,712(-164), VOA 포함5,325→5,161.
VOA ingestion은 관측된 댓글 안내 문단 제거 후 본문 최소 길이를 검사.
**검증:** 결함18/VOA관련27 회귀. 잘못된 ATP 양성 fixture를 wiki 예시로 바로잡고 ATP 음성 회귀 추가.
**잔여 위험:** 기존 VOA450편 중4편/100문항 연결. 본문·앵커 영향 때문에 기존450편 보존/검토.
품질 신호만으로 자동 반려하지 않으며 신호 없음도 품질 승인이 아니다.
**다음:** Gate 8.

## Gate 8 — 미판정·분석 미완

**상태: PASS (원인 분류·안전한 복구)**

**확인:** 미판정48,811 = PLOS raw31,367 + 게이트 누락17,444.
누락은 VOA10,360/Gutenberg3,812/Europe PMC1,295/Frontiers1,957/NIST10/original10.
실패 여부가 기록되지 않은 자료도 포함하며 모두 분석 실패라고 단정하지 않는다.
**변경:** raw는 발췌 후 판정, 나머지는 내용 검토. 분석15편 중 word_count3건,
기존 `compute_syntax_score(content)`로 재현 가능한 syntax9건만 revision 조건으로 복구. JSON의 다른 키 보존.
**검증:** 15편 전체 본문 MD5 변화0. 캐시15편 재검증/12편 변경. 분석 미완15→3.
**잔여 위험:** V-Level 없는3편은 임의 부여 없이 검토:
`2ace785f-8f6f-4dc3-b70e-b0d7e589504f`, `3fa58838-1ca3-4012-8021-6370e9705a57`, `c841a6aa-f600-472a-9cae-583baf9f58d2`.
**다음:** Gate 9.

## Gate 9 — 스냅샷

**상태: PASS**

**확인:** 90편은9/15 이후 신규 원문, 구등급 usable85/excerpt5. 개별 ID 보존. 스냅샷은 재생성 캐시.
**변경:** 원천 재고·적격v3 스냅샷을 DB에서 재생성.
**검증:** 전체109,043/후보87,716; 재고·후보·6등급 delta 모두0, version 일치.
**잔여 위험:** 새 수집 이후 다시 낡을 수 있어 시각 표시와 drift guard로 검출.
**다음:** Gate 10.

## Gate 10 — 전수 재조정

**상태: PASS**

**확인:** metadata109,043, 후보/캐시87,716, article 문항 참조38,605원문.
**변경:** 전체 적재 후 동시 변경1편도 최신 revision으로 재검증.
**검증:** audit `--check` exit0. cache missing/stale/grade drift, reject/harmful 적격,
blocker/분석 미완 적격, CEFR 모순, windows-only 적격, 참조 고아 모두0.

| 최종 등급 | 편수 |
|---|---:|
| usable / 적격 | 9,103 |
| excerpt / 문항별 검증 조건부 | 4,296 |
| excerpt-blind / 발췌 준비 | 10,861 |
| unjudged / 내용 판정 대기 | 48,811 |
| unknown / 분석 미완 | 3 |
| blocked / 사용 불가 | 14,642 |
| 합계 | 87,716 |

**잔여 위험:** 순차 스캔은 단일 MVCC snapshot이 아니다. 그 사이 원문 변경은 SQL revision 가드가 차단.
**다음:** Gate 11.

## Gate 11 — 재발 방지

**상태: PASS (구현·로컬 실행), 일정 실행 활성화는 배포 대기**

**확인:** 새 원문·갱신·정제 오탐의 재발 경로.
**변경:** canonical 회귀/감사, VOA 정제, revision fail-closed, machine-readable reason/blocker, 일일 read-only workflow.
**검증:** 패키지2,577/감사가드5 통과. 실제 cache revision 변경 시 사용 차단을 확인 후 롤백.
**잔여 위험:** workflow는 기본 브랜치 반영·secrets 설정 후 작동. 원격 일정 실행을 완료했다고 주장하지 않음.
**다음:** Gate 12.

## Gate 12 — 운영 UI

**상태: PASS**

**확인:** 기존 원천 작업공간에 개별 원문 운영을 연결하는 확장.
**변경:** 집계→큐→실제 본문 inspector→재검증. WHY·분석·발췌·문항/교재/시도·품질·이력 조회.
관리자 API 가드, cross-origin 쓰기 차단, 조회 실패를0으로 숨기지 않는 응답 및 도움말.
**검증:** Playwright9 통과. 390다크/1280라이트 inspector, axe, 포커스 복원, 1280/1440/1920 첫 행749px.
**잔여 위험:** 과거 교재 노출은 unknown. 기존 전역 Admin 보라색은 이번 변경에서 추가하지 않음.
**다음:** Gate 13.

## Gate 13 — 최종 검증·배포 경계

**상태: PASS (기능·DB·production build 검증), 배포는 BLOCKED**

**확인:** 승인 SQL2개와 캐시 적용. 원문·문항·정답 삭제 없음.
**변경:** 보고서·스키마·파이프라인·라우트·도움말·CHANGELOG 갱신. `pnpm docs:db-stats` 실행.
**검증:** 패키지143파일/2,577테스트, 웹20파일/281테스트, 감사5, 브라우저9 통과.
기존123개는 이 범위에 포함되며 삭제하지 않았다. web/package typecheck 통과. web lint 오류0(기존 경고).
production build 최종 exit0, 정적 페이지236개 생성. 분리된 build 서버3107에서 비로그인
관리자 페이지307→로그인, 신규 API401, 학습자 연습307→로그인을 확인했다.
실 DB 정상 topic/insert 채점·기록 생성, 반려 채점 차단, stale 차단 후 전부 롤백.
`textbook_practice_items(5,50)` 반환50문항 정책 위반0.
실제 V5 `loadVolume` 읽기 전용 실행도 완료(2026-09-19 00:00 KST): 문항 연결 원문6,049편 중
5,934편 통과, 미판정101/차단14 제외, 2단원12문항 조합. DB 적재나 교재 발행은 하지 않았다.
도움말 최종 수정 후 화면/가이드56개 회귀 및 web typecheck 재통과.
**잔여 위험:** 공용 에이전트 설정8/9, 기존 `.codex/config.toml` GENERATED 마커 누락.
공유 트리에 다른 작업 변경이 다수이고 이번 작업도30파일 초과. 자동 커밋/push/배포하지 않았다.
**다음:** 변경 범위 검토·공용 설정 검사 해소 및 30파일 이상 변경 승인 후 커밋/PR. 기본 브랜치 반영 후 원격 일정 감사 활성화.

## 체크포인트와 복구

`csat-source-policy-v3-20260918`, `csat-source-analysis-repair-12` before/after 및 diff 확인.
캐시180.8MB, DB 증가 약181MB. 사라진 수집 지표 `library_chapter_quiz`는 직접 조회2,453행/4,120kB로 존재 확인.
bloat 표본 교체는 정상 회전. history anon 기본 grant는 RLS 실조회0행으로 확인.

`.agent-logs`에 전수 전후 감사JSON, 90편 ID, 배치 캐시 백업, 12건 수정 전후 값/MD5/SQL,
세 소비자 함수 적용 전 정의를 보존. 복구는 원문 전체 덮어쓰기 없이 해당 캐시/필드만 revision 대조 후 수행.
소비자 함수 복구가 필요하면 이전 정의를 별도 승인 migration으로 적용한다. 캐시 DROP은 불필요.

최종 전수 감사의 시각·분모·등급·drift·잔여 발견은
[기계 판독 결과](./csat-sources-final-audit-20260918.json)에 보존한다.
