# 혁신 설계 우선순위 (Gate 5)

> 생성 2026-09-18 · Claude Code · 근거: [verdict.md](verdict.md)(등급) · [flows.md](flows.md)(여정) · 브리프의 DB 질의(데이터 가용성).
> 다음 단계는 **상위부터 한 화면씩 vocaflow-design §G3 발산 4안 → 사람이 고름 → 2회 수정 → 골든**이다. 이 문서는 순서만 정한다.

## 점수 = 수요 영향 × 평균 정도 × 데이터 용이도

| 인자 | 값 | 근거 |
|---|---|---|
| 수요 영향 | 여정 ①·② 위 = **3** · 여정 ③·④ 위 = **2** · 그 밖 = **1** | 지시문 — ①② 가 활성화(가입 → 첫 학습 중앙값 55일, AGENTS/DESIGN_SYSTEM) |
| 평균 정도 | 평균 = **2** · 판정 보류(코드 추정 불통과) = **1.5** · 경계 = **1** · 서명 있음 = **0** | verdict.md |
| 데이터 용이도 | G1 후보 자산이 지금 있음 = **3** · 조인만 필요 = **2** · 드레인·신규 데이터 필요 = **1** | 브리프의 DB 질의(2026-09-18) |

- 여정 밖 화면의 최대 점수 = 1 × 2 × 3 = **6** → 10위(12점)에 닿지 못한다. 그래서 채점은 여정 위의 화면만 정밀하게 했다(관리자 60 · 라이브러리 전부 · 게임 제외 포함).
- 동점은 ① 여정 번호가 앞선 것 ② 같은 목적의 화면은 한 브리프로 묶어 한 자리를 쓴다(`/dashboard` + `/reports`).

## 여정 위 화면 채점

| 화면 | 여정 | 수요 | 등급 | 평균 | 데이터(근거) | 용이 | **점수** |
|---|---|--:|---|--:|---|--:|--:|
| `/` | ① | 3 | 서명 있음 | 0 | — | — | **0** |
| `/fit` | ① | 3 | 평균 | 2 | 커버리지 계산 코드 있음 | 3 | **18** |
| `/fit/s/[payload]` | ① | 3 | 보류 | 1.5 | URL payload | 3 | **13.5** |
| `/signup` | ①→② | 3 | 평균 | 2 | 직전 증명은 URL payload 로만(서버 저장 없음) | 2 | **12** |
| `/verify-email` | ② | 3 | 평균 | 2 | 이 화면에 붙일 자산 없음(autoconfirm 이라 도달 드묾 — 카드 추정) | 1 | 6 |
| `/hub` | ②③ | 3 | 평균 | 2 | `vocabularies` stability 2,249행 · S1 곡선 코드 | 3 | **18** |
| `/diagnostic` | ② | 3 | 평균 | 2 | `lexical_coverage` 311/312권 × V-Level | 3 | **18** |
| `/flashcard/play` | ②③ | 3 | 평균 | 2 | 카드별 stability·last_review_at | 3 | **18** |
| `/text/[id]` | ③ | 2 | 평균 | 2 | `vocabularies.text_id`·lemma — 조인 키가 이미 컬럼으로 있다(드레인 불필요) | 3 | **12** |
| `/wordvault/review`(+study) | ③ | 2 | 평균 | 2 | FSRS 전부 보유 | 3 | **12** |
| `/dashboard` + `/reports` | ③ | 2 | 평균 | 2 | stability · daily_activity 61 · weekly_reports 1 | 3 | **12** |
| `/text/new` | ④ | 2 | 평균 | 2 | 커버리지 계산 코드 | 3 | **12** |
| `/dictate/session` | ③ | 2 | 평균 | 2 | dictation_sessions 7행 — 단어별 오류 형태는 조인 필요 | 2 | 8 |
| `/practice/dcp` | ③ | 2 | 평균 | 2 | 구문 연습 데이터 — 조인 필요 | 2 | 8 |
| `/teacher` | ④ | 2 | 평균 | 2 | 학급 1 · 구성원 **0** · 과제 **0** — 실데이터 없음 | 1 | 4 |
| `/join/[code]` | ④ | 2 | 보류 | 1.5 | 같은 이유 | 1 | 3 |

(`/text/[id]` 행은 판단이 갈린다 — 조인 키가 이미 있어 3 으로 채점했다. "조인 필요" 로 보면 2 → 8점으로 11위가 되고, 10위 자리는 동점 없이 `/text/new` 까지다.)

## 상위 10

| 순위 | 화면 | 점수 | 브리프 | 한 줄 — 왜 지금 |
|--:|---|--:|---|---|
| 1 | `/fit` | 18 | [fit.md](briefs/fit.md) | 랜딩(서명 있음)이 약속한 도구가 무채색 textarea — **증명이 광고보다 약하다**. 선언 `@form` 과도 불일치 |
| 2 | `/hub` | 18 | [hub.md](briefs/hub.md) | 활성화 ①② + 매일 루프의 문. S1 곡선이 사이드바 곁가지에 갇혀 있다 |
| 3 | `/diagnostic` | 18 | [diagnostic.md](briefs/diagnostic.md) | 전역 헤더가 약속하는 「312권 중 읽을 수 있는 책」 을 보여 줄 데이터가 이미 있는데 SaaS 히어로 카드 + D5 위반 |
| 4 | `/flashcard/play` | 18 | [flashcard_play.md](briefs/flashcard_play.md) | 첫 학습의 도착점이 Anki 와 구별되지 않는다. `ForgettingCurve.tsx` 0바이트 |
| 5 | `/fit/s/[payload]` | 13.5 | [fit.md](briefs/fit.md) | 교사가 공유한 결과를 받은 사람이 빈 입력칸부터 본다(코드 추정 — 유효 payload 캡처 필요) |
| 6 | `/signup` (+ 인증 3화면) | 12 | [signup.md](briefs/signup.md) | 1차 행동이 첫 뷰포트 밖 · `next` 유실 · 방금 본 증명이 사라진다 |
| 7 | `/text/[id]` | 12 | [text_id.md](briefs/text_id.md) | 제품의 본체인데 **모든 단어가 new 고정** — 데이터는 있고 코드가 비어 있다 · 지어낸 수치(I5) |
| 8 | `/wordvault/review` (+study) | 12 | [wordvault_review.md](briefs/wordvault_review.md) | 복습 화면에 망각이 없다 · 하드코딩 간격(I5) · 두 라우트 픽셀 동일 |
| 9 | 회고 `/dashboard` + `/reports` | 12 | [retrospect.md](briefs/retrospect.md) | 선언한 환경 변형이 안 그려진다 · 오류를 빈 상태로 삼킨다 · 통합 후보 |
| 10 | `/text/new` | 12 | [text_new.md](briefs/text_new.md) | 교사 여정의 끝 — 붙여 넣은 글이 칠해지지 않는다 · 준비 안 된 입력을 된다고 말한다 |

## 공식 밖에서 사람이 볼 것

- **`/library/books`(DD-04 골든 1호, 발산 4안 작성 완료)는 이 공식으로 6점** — 여정 밖이라 상위 10 밖이다. 이미 [compare/library-books.md](../compare/library-books.md) 가 있으므로 병행할지, 이 순위로 갈아탈지 **사용자 결정**.
- **`/teacher`(렌즈 6 — 유일한 성장 경로)는 4점** — 학급 구성원·과제가 **0**(DB)이라 데이터 용이도가 1 이다. 공식은 낮게 매기지만 전략상 중요도는 높다. 실데이터 없이 예시로 설계할지 **사용자 결정**.
- **서명 있는 2화면(`/` · `/csat`)은 0점** — 발산 대상이 아니라 **골든 스크린 후보**다. 특히 `/csat` 은 390 첫 뷰포트에 B 도식과 `=` 병합이 없다(판정) — 골든으로 굳히기 전 1회 수정.
- 형태보다 먼저 고칠 렌더 결함(verdict.md 표)은 이 순위와 별개로 즉시 처리 대상이다(`[object Object]` · 개발 오류 오버레이 · 한글 이탤릭 등).

## 통합 기회 (화면 수를 줄이는 것도 설계다)

flows.md 「중복 · 통합 후보」 + 캡처로 확인된 쌍:

| 후보 | 근거 | 제안 |
|---|---|---|
| `/wordvault/review` ≡ `/wordvault/study` | 같은 컴포넌트·같은 쿼리·픽셀 동일 | 하나로 합치거나, review 에 due 필터를 실제로 건다 |
| `/library/textbooks` ≡ `/library/textbooks/[series]` | 픽셀 동일(색인 목적) | canonical 선언(코드 수정 아님 — 확인 필요) |
| `/flashcard` ≡ `/spellforge` 허브 · `/wordblitz` ≡ `/pairflip` 허브 | 레이아웃·문구 동일 | 모듈 허브를 **하나의 연습 입구**로(`/practice` 와 함께) — 10번째 모듈 금지(§F)의 반대 방향 |
| `/dashboard` + `/reports` | reports 입구가 dashboard 한 곳 | 회고 한 화면(브리프 retrospect) |
| `/my/books` ≡ `/text?view=books` ≡ books 「이어서 학습」 | 사이드바 주석 "주소만 다르다" | 하나로 |
| 인증 4화면 | 같은 틀 | signup 브리프의 결정을 따른다 |
| 관리자 「셀 것 없음」 4화면 · VCB 생성 2경로 · 기출 분석 2표면 | [cards/admin/_table.md](cards/admin/_table.md) (1) | 관리자 정리는 별도 트랙(점수 6 이하) |
