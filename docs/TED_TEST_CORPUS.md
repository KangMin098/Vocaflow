# TED 골든 테스트 세트 (스크립트 기능 회귀·자기발전용)

> 사용자 입력 스크립트 경로(`texts.content`)의 기능·프로세스·사용성을 **회차마다 동일 조건으로** 재평가하기 위한 고정 코퍼스.
> 작성 2026-08-13. 길이는 ted.com 플레이리스트 페이지 실측(2026-08-13 확인).

---

## 왜 이 세트인가

| 근거 | 실측값 |
|---|---|
| `vocaflow_domains.science_tech` 등록 단어 | **0** (`total_words = 0`, `data_source_keys = []`) — 테스트가 곧 도메인 데이터 적재 |
| `texts` 중 본문이 실제로 있는 행 | **275 중 6행** — 사용자 입력 경로는 사실상 미검증 |
| 그 6행의 최대 본문 길이 | **6,781자** (≈1,100 단어) |
| 본 세트 최장편(Suleyman 22:01) 추정 | **≈3,300 단어 / ≈20,000자** — 기존 상한의 **약 3배** |

과학·기술은 한 지문 안에 일상어와 전문어가 함께 들어와 **V-Level 스팬이 넓다**. 문학·일상 지문은 스팬이 좁아 통과만 하고 결함을 드러내지 못한다.

### 밴드 설계 정정
당초 "5분 ≈800단어" 밴드를 상정했으나, **TED 메인스테이지 토크에는 그 밴드가 사실상 없다** (최단이 8분대). 800단어대가 필요하면 TED-Ed(별도 포맷)를 따로 잡아야 한다. 아래 S 밴드는 8~10분 / 1,200~1,500단어로 조정했다.

> 단어 수는 모두 **분당 150단어 추정치**다. 입력 후 실측으로 대체할 것.

---

## 0. 워밍업 3편 — 스모크 테스트

특이점 없는 서사형 1인칭. **여기서 실패하면 원인은 100% 코드**다.

| # | 화자 | 제목 | 길이 | 추정 단어 |
|---|---|---|---|---|
| W1 | Julian Treasure | How to speak so that people want to listen | 09:44 | ≈1,460 |
| W2 | Robert Waldinger | What makes a good life? Lessons from the longest study on happiness | 12:37 | ≈1,890 |
| W3 | Tim Urban | Inside the mind of a master procrastinator | 13:54 | ≈2,080 |

---

## 1. 주력 15편 — 과학·기술

### S 밴드 (8~10분 · ≈1,250~1,500단어)

| # | 화자 | 제목 | 길이 | 추정 단어 | 특이 부하 |
|---|---|---|---|---|---|
| S1 | Bill Gates | The next outbreak? We're not ready | 08:23 | ≈1,260 | 감염병 용어 · 연도·수치 |
| S2 | Zahra Biabani | The eco-creators helping the climate through social media | 09:30 | ≈1,430 | 고유명사(플랫폼·인명) 밀집 |
| S3 | Solomon Goldstein-Rose | How much clean electricity do we really need? | 09:36 | ≈1,440 | **단위·숫자 최고 밀도** (TW, kWh) |
| S4 | Alexandr Wang | War, AI and the new global arms race | 09:52 | ≈1,480 | 약어(AI, ML) · 지명 |
| S5 | Emma Nehrenheim | The powerful possibilities of recycling the world's batteries | 09:55 | ≈1,490 | 화학 물질명 · 복합명사 |

### M 밴드 (10~15분 · ≈1,650~2,250단어)

| # | 화자 | 제목 | 길이 | 추정 단어 | 특이 부하 |
|---|---|---|---|---|---|
| M1 | Dan Jørgensen | How wind energy could power Earth ... 18 times over | 10:57 | ≈1,640 | 제목 내 `...` · 비영어권 화자명 |
| M2 | John Doerr & Ryan Panchadsaram | An action plan for solving the climate crisis | 11:36 | ≈1,740 | **화자 2인 — 화자 전환 파싱 테스트** |
| M3 | Stacy Kauk | The billion-dollar pollution solution humanity needs right now | 13:09 | ≈1,970 | 금액·규모 표현 |
| M4 | Gary Marcus | The urgent risks of runaway AI — and what to do about them | 14:02 | ≈2,100 | 제목 내 em dash |
| M5 | Jamie C. Beard | The untapped energy source that could power the planet | 14:56 | ≈2,240 | 지열 전문어 · 이니셜 포함 화자명 |

### L 밴드 (15~22분 · ≈2,280~3,300단어)

| # | 화자 | 제목 | 길이 | 추정 단어 | 특이 부하 |
|---|---|---|---|---|---|
| L1 | Fei-Fei Li | With spatial intelligence, AI will understand the real world | 15:11 | ≈2,280 | 비영어권 화자명 |
| L2 | Yejin Choi | Why AI is incredibly smart and shockingly stupid | 16:02 | ≈2,400 | 대조 구문 · 구어 강조 |
| L3 | Avi Loeb | My search for proof aliens exist | 18:06 | ≈2,720 | 천문 고유명사 · 관측값 |
| L4 | Johan Rockström | The tipping points of climate change — and where we stand | 18:35 | ≈2,790 | 임계값·퍼센트 다수 |
| L5 | Mustafa Suleyman | What is an AI anyway? | 22:01 | ≈3,300 | **세트 최장 — 상한 테스트** |

### 예비 (상한 파괴용 · 정규 세트 아님)

| 화자 | 제목 | 길이 | 추정 단어 |
|---|---|---|---|
| Eric Schmidt & Bilawal Sidhu | The AI revolution is underhyped | 25:37 | ≈3,840 |
| Sam Altman | OpenAI's Sam Altman talks ChatGPT, AI agents and superintelligence — live at TED2025 | 47:29 | ≈7,120 |

Altman 편은 **대담 형식**이라 화자 전환이 수십 회 발생한다. 정규 회차에 넣지 말고, 입력 상한·청크 분할이 무너지는 지점을 찾을 때만 쓴다.

---

## 2. 3단계 로드맵에서의 위치

> **진행 상태 (2026-08-14 기준)** — 이 표의 W1~L5 **실제 TED 원문은 아직 한 편도 입력되지 않았다**
> (`scripts/extract-coverage/corpus/` 에 `*.txt` 없음). 지금까지의 회차는 두 갈래로 갔다:
> **1~10회차**는 자작 대체 코퍼스(`sectors/` 9편 28,380자)와 `sample-talk.txt` 로 **사전·추출 정확도**를,
> **11~16회차**는 학습자 화면의 **접근성·흐름**을 잡았다(CHANGELOG 참조).
> 즉 아래 3단계는 **아직 1단계 전**이다 — 원문 입력이 남은 선행 작업이다.

| 단계 | 대상 | 노리는 것 |
|---|---|---|
| 1 스모크 | W1~W3 | 파이프라인 정상 동작 |
| 2 주력 | S1~L5 (15편) | 어휘추출 정확도 · V-Level 분포 · `science_tech` 적재 · 9모듈 전수 |
| 3 스트레스 | 공연·코미디형 5편 + 예비 2편 | `[Laughter]` `[Applause]` 등 비언어 마커 · 구어 축약 · 담화표지 |

3단계의 비언어 마커는 **반드시 마지막**에 둔다. 1·2단계에서 함께 깨지면 원인 분리가 불가능하다.

---

## 3. 회차마다 기록할 지표

편당 다음을 남긴다. 이 값들의 **회차 간 델타**가 곧 "자기발전"의 정의다.

| 지표 | 확인 위치 |
|---|---|
| 입력 성공 / 실패 사유 | 스크립트 입력 화면 |
| 실제 단어 수 · 문자 수 | `length(texts.content)` |
| 추출 어휘 수 | `vocabularies` 해당 text |
| 오추출 건수 (고유명사·복합어·단위 오분해) | 수동 채점 |
| 산정 V-Level · VRL 점수 | `texts.text_v_level` · `text_vrl_score` |
| ScriptQuiz 생성 문항 수 | `library_chapter_quiz` 또는 대응 경로 |
| 9모듈 진입 성공 여부 | 각 모듈 라우트 |
| 체감 사용성 메모 | 자유 기술 |

---

## 3-1. 자동 커버리지 측정 (`scripts/extract-coverage/`)

핵심 지표 하나 — **"본문 단어 중 몇 %가 학습자원이 되는가"**.

```bash
npx tsx scripts/extract-coverage/measure.ts                          # 기본 샘플 1편
npx tsx scripts/extract-coverage/measure.ts scripts/extract-coverage/corpus   # 코퍼스 일괄
npx tsx scripts/extract-coverage/measure.ts corpus --json            # 기계 판독
```

디렉터리를 주면 그 안의 `*.txt` 를 **편별로** 측정하고 합산 리포트를 낸다. 회차 입력은
`scripts/extract-coverage/corpus/` 에 넣는다 (`*.txt` 는 git 미추적).
파일명이 리포트의 "편" 이름이 되므로 `S1-...` `M2-...` 처럼 밴드 접두어를 붙이면 읽기 쉽다.

리포트 구성:
1. **편별 표** — 자 수 · 후보 · 해석 · 커버리지
2. **합산** — 코퍼스 전체 커버리지 (회차 간 비교 기준)
3. **사전 갭 조치별 분류** — `/admin/pending-words` 와 같은 규칙. 등재할 것과
   **등재하면 안 되는 것**(철자 변이 = 해석기 버그)을 갈라 준다
4. **토큰화 처리 내역** — 상한 절단이 0 이 아니면 누수 경고

토큰화(클라이언트)와 사전 해석(서버)을 **분리해서** 보고한다 — 어느 쪽이 흘렸는지
귀속시킬 수 있어야 하기 때문이다.

### 2026-08-13 1회차 실측 (sample-talk.txt · 586어)

| 지표 | 값 |
|---|---|
| 토큰화 후보 | 242 |
| 사전 정확일치 | 176 (72.7%) |
| `resolve_dict_headword` 4계층 해석 후 | **229 (94.6%)** |
| 미해결 | 13 |

미해결 13 중 **6개는 어기가 이미 사전에 있었다** (`geochemist`→chemist ·
`unglamorous`→glamorous · `mislabeled`→label · `overselling`→sell ·
`mineralized`/`mineralizes`→mineral). 즉 사전 부족이 아니라 **해석기가 접두사(un-/mis-/over-/geo-)와
`-ize` 계열을 다루지 않는 것**이다.

나머지는 하이픈 전체형 2(부분은 이미 해석됨 · 실질 누수 아님) · 고유명사 1 · 약어 1 ·
진성 사전 갭 1(`sorbents`).

## 4. 배제 기준

| 배제 대상 | 이유 |
|---|---|
| 정치 논쟁 · 개인 트라우마 서사 | Calm UI / Empathetic Feedback 철학과 충돌. 반복 테스트로 수십 회 읽는 부담 |
| TEDx 토크 | 편집 검수 수준 편차가 커서 회귀 기준선으로 부적합 |
| 비영어 원어 토크 | 트랙·도메인 분류 전제가 영어 |

---

## 5. 테스트 후 정리

이 코퍼스는 **회귀 측정용 임시 데이터**다. 회차가 끝나면 입력한 `texts` 행과 그로부터 파생된
`vocabularies` 를 삭제한다. 남겨두면 다음 회차의 추출이 "이미 학습 중" 필터에 걸려
결과가 회차마다 달라진다 (`extract_vocabulary_for_user_v2` 는 `vocabularies`·`word_familiarity`
에 있는 단어를 후보에서 뺀다).

```sql
-- 회차 종료 후 (테스트 계정 한정)
DELETE FROM vocabularies WHERE user_id = :test_user AND text_id IN (SELECT id FROM texts WHERE user_id = :test_user);
DELETE FROM texts WHERE user_id = :test_user;
```

`word_familiarity` 의 `known` 판정도 다음 추출을 영구 축소하므로 함께 되돌린다.

---

## 출처

길이는 아래 ted.com 플레이리스트 페이지 표기값 (2026-08-13 확인).

- https://www.ted.com/playlists/171/the_most_popular_talks_of_all_time
- https://www.ted.com/playlists/836/tech_that_s_reshaping_the_future
- https://www.ted.com/playlists/852/most_popular_ted_talks_of_2024
- https://www.ted.com/playlists/310/artificial_intelligence
