# /csat 기출분석공간 재설계 — 테스트 보고 (2026-09-25)

> 과제 6단계 산출물. 설계는 [ia-design.md](./ia-design.md), 근거는 [needs-research.md](./needs-research.md).
> 시나리오 스펙: `apps/web/tests/e2e/csat-continuity.spec.ts` · 지표 스크립트: `scripts/csat/continuity-metrics.mjs`.

## 1. 시나리오 — 도달 · 클릭 수

실행: `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/csat-continuity.spec.ts --workers=1 --trace=off`(개발 서버, 검증 계정).
클릭 수는 `/csat` 진입 뒤 누른 횟수(주소 입력 제외). 학습 기록은 서버 사본(`/api/csat/state`)에 심고, 새 브라우저 컨텍스트(= 빈 기기)에서 연다.

| # | 시나리오 | 도달 | 클릭 | 목표 | 판정 |
|---|---|---|---|---|---|
| C1 · A1 | 첫 방문 → 「처음이라면」 → 3문항 시작 | `/csat/dissect` | 1 | 1 | ○ |
| A2 | 목적별 「킬러 유형 잡기」 → 빈칸 추론 줄 → 예시 문항 | `/csat/item/*` | 3 | 3 | ○ |
| A3 | 목적별 「오답 선지 설계 보기」 → 함정 줄 → 예시 문항 | `/csat/item/*` | 3 | 3 | ○ |
| A4 | 목적별 「근거 문장 찾기」 → 지도 있는 문항 → 근거 칩 | 지문 지도 | 3 | 3 | ○ |
| A5 | 목적별 「최근 기출부터」 → 번호 칩 | `/csat/item/*` | 2 | 2 | ○ |
| A6 | 유형별 「문장 삽입」 → 번호 칩 · **목적 축과 같은 서가 주소** | `/csat/item/*` | 2 | 2 | ○ (주소 일치 확인) |
| A7 | 회차별 「2026학년도 수능」 → 31번 | `/csat/item/2026-31` | 2 | 2 | ○ |
| C2 | 재방문(멈춘 세트 2/3) → 이어서 하기 | `/csat/dissect?resume=1` | 1 | 1 | ○ |
| C5 | **다른 기기** — 서버에만 있는 세트가 빈 기기에서 이어서 카드로 선다 | 〃 | 1 | 1 | ○ |
| C3 | 재방문(다음 날 · 복습 2) → 카드에 「오늘 복습 2개」 → 시작 | `/csat/dissect` | 1 | 1 | ○ |
| C4 | 공백 복귀(8일 · 밀린 복습 9) → 「9개 중 오늘은 3개」 · 서버 사본의 오늘 몫 ≤ 3 | `/csat/dissect` | 1 | 1 | ○ |
| C6 | 문항 해설 → 「이 유형 목록」 | `/csat/browse?type=` | 1 | 1 | ○ |
| C7 | Today(`/hub`) → 「기출 이어서」 | `/csat/dissect?resume=1` | 1 | 1 | ○ |

**14개 목표 전부 달성**(12 테스트 · 1.1분). 목표 미달 시나리오 없음.

## 2. 테스트가 찾아 고친 결함

| 발견 | 증상 | 수정 |
|---|---|---|
| A2 첫 실행 | 같은 경로 안 링크(`/csat` → `/csat?need=killer`)는 컴포넌트를 재사용해 **첫 필터가 남았다** — 메뉴를 눌러도 표가 안 좁혀짐. 서가(`?type=` · `?exam=`)도 같은 구조 | 두 페이지가 쿼리를 `key` 로 걸어 다시 세운다 |
| C3 첫 실행 | 서버 저장(PUT)이 **통째 덮기**라 탭 둘 · 기기 둘 중 늦게 쓴 쪽이 다른 쪽 학습을 지웠다(열린 채 남은 앞 시나리오 탭이 1.5초 뒤 덮어씀) | PUT 이 서버 사본과 **항목 단위로 합친다**(`mergeDissection`). 테스트는 시나리오마다 컨텍스트를 닫는다 |
| 단위 테스트 추가 | 복습 문항은 다른 문항으로 바뀌었지만 **복습의 원래 문항이 같은 세트 첫 문항으로 다시** 들어왔다(외운 문항을 한 세트 안에서 다시 봄) | `composeDissection` 이 복습이 걸린 세트에서 원래 문항을 뺀다 |
| 적용 전 조사 | `funnel_events` CHECK 제약에 `csat_space_scoped` · `csat_space_opened` 가 없어 9-23 이후 **0건 저장** | 마이그레이션 `20260925093100` 에 포함. 적용 뒤 `csat_space_opened` 15건/일 저장 확인 |
| C2 첫 실행 | 카드 상태 확인 5초 타임아웃(개발 서버 첫 컴파일) — 앱 결함 아님 | 상태 확인만 20초 |
| A7 첫 실행 | Playwright 추적 기록 준비 30초 초과 — 환경 문제 | `--trace=off` |

## 3. 지속 학습 지표가 실제로 기록되는가

마이그레이션 두 개(`20260925093000_csat_learner_state` · `20260925093100_funnel_allow_csat_continuity`)는 2026-09-25 사용자 승인 뒤 적용했다.
시나리오 실행 뒤 `node --tls-max-v1.2 scripts/csat/continuity-metrics.mjs --days 1`:

| 지표 | 이벤트 | 기록 | 값(테스트 계정 — 뜻 없음) |
|---|---|---|---|
| 홈 진입 상태 분포 | `csat_home_viewed` | ○ | first 38 · return 13 · comeback 5 |
| 이어하기 사용률 | `csat_resume_clicked` | ○ | 11/18 (home 10 · today 1) |
| 경로 비율 | `csat_path_chosen` | ○ | need 22 · type 9 · exam 5 |
| 막다른 길 해소 | `csat_item_back` | ○ | type 1 |
| 세트 시작 | `csat_session_started` | ○ | 8 |
| 복습 시작 · 완료 | `csat_review_started` · `csat_review_done` | **e2e 로는 미확인** | 0 — 심은 복습 태그가 실제 공식 태그가 아니라 세션이 복습 문항을 고르지 않았다. 고르는 규칙은 단위 테스트(`dissect.test.ts` 「복습은 같은 공식의 다른 문항」)로 확인. 끝까지 푸는 e2e 는 학습자 PDF(기기 reflow)가 필요해 자동화하지 않았다 |
| 재방문율 D1 · D7 | 위 이벤트의 user_id · 날짜 | 계산 가능 | 오늘 시작이라 분모 0 |
| 서버 사본 | `csat_learner_state` | ○ | C4 에서 압축 결과(오늘 몫 ≤ 3)가 서버에 반영됨 확인 |

⚠️ 실사용 수요는 여전히 사실상 0이다(사용자 2 = 검증 계정). 지표는 **기준선 0에서** 시작한다.

## 4. 빌드 · 타입 · 회귀

| 검사 | 결과 |
|---|---|
| 타입(`tsc --noEmit`) | 오류 0 |
| lint(`pnpm lint`) | 오류 0 · 경고는 기존 것만(예: `RecallCard.tsx` exhaustive-deps) |
| 프로덕션 빌드(`NEXT_DIST_DIR=.next-build-claude pnpm build`) | **통과** — `/csat` · `/csat/browse` · `/csat/record` · `/csat/space`(redirect) · `/api/csat/state` 생성 |
| 단위 테스트(`vitest run` 전체) | 3,812 통과 · 실패 11 → 이번 변경 탓 3개는 고침(아래) · 남은 실패는 이번 변경과 무관 |
| 이번 작업 관련 회귀 | `continuity` 15 · `dissect`(복습 대체 1 추가) · `events` · `route-guards` · `link-graph-ratchet` · `shell-reach` 전부 통과 |

**이번 변경 탓이던 실패 3 — 고침**
- `doc-path-drift`: MODULES.md 가 지운 `CsatLibrary.tsx` 를 가리킴 → 새 컴포넌트로 교체
- `unreachable-modules`: 지운 `SessionHome` 만 쓰던 `lib/csat/pattern-art.ts` 가 고아 → 삭제
- `offset-paging-budget`: 지표 스크립트의 `.range()` → 시각 기준 키셋 페이징

**남은 실패(무관 · 이번에 건드리지 않은 영역)**
- `factory-model` — `scripts/textbook/harvest-gutenberg-kid.mjs` 없음(다른 세션 커밋 `833edfe9` 이 수확기를 퇴출)
- `content-quality-gate.integration` 2 · `resolve-headword.integration` 4 — 도서 · 사전 DB 데이터 상태
- `freedom-view` — 교재 자유도 스냅샷 기준선

**빌드 중 환경 문제(앱 결함 아님)**
- 첫 빌드가 린트·타입 단계에서 Node 가 `0xC0000409` 로 죽음 → `NODE_OPTIONS=--max-old-space-size=8192` 로 재시도해 통과
- 다른 로컬 빌드 폴더(`.next-dev` · `.next-e2e` 등 11곳, git 밖)에 남은 옛 `(main)/csat/page.ts` 타입이 옮긴 경로를 가리켜 타입 검사를 막음 → 그 생성물만 지움(다음 빌드가 다시 만든다). 새로 받은 CI 에는 없는 문제다.

## 5. 남은 일

- 복습 시작 · 완료 이벤트의 **실제 기록**은 학습자 PDF 가 있는 해부 세션을 끝까지 돌아야 나온다 — 첫 실사용 뒤 `scripts/csat/continuity-metrics.mjs` 로 확인한다.
- 재방문율 D1 · D7 은 7일 뒤부터 분모가 선다. 분기 진단(PLATFORM_AUDIT, 다음 2026-10)에서 읽는다.
