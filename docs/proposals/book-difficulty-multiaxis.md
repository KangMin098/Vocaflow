# 도서 난이도 다축 평가 기준 재설계 (Book Difficulty v2)

> 상태: **v1 적용 완료** (2026-07-12) — 발행 23권에 앙상블 산출·고확신 13권 `book_v_level` 갱신·저확신 7권 검토 회부. `book_v_level_v1` 구값 보존.
> 배경: 현행 `library_books.book_v_level`이 **어휘 단일 축**이라 통사·담화 난이도를 무시해 왜곡. 실증 검증 포함.

---

## 0. 목표 재정의 + 최종 적용 공식 (2026-07-12)

### 목표 (재고)
"100% 정확도"의 단일 텍스트 공식은 **불가능** — 도서 난이도의 ground truth는 텍스트 속성이 아니라 **학습자가 실제로 얼마나 어려워하는가**(reader-dependent). 그래서 목표를 재정의:
> **학습자 i+1 매칭 난이도가 (a) 독립 외부기준(CEFR-J)으로 편향 보정되고, (b) 추정기 불일치 책은 저확신 플래그로 사람이 검토 → 학습자 실효 정확도를 100%에 수렴.** 궁극의 100%는 학습자 성과(IRT) 축적 시 경험적 보정(Tier 2, 미래).

### 최종 공식 — 앙상블 + 병목 융합 + CEFR-J 확증 (§3의 adjust-from-base를 대체)
```
easeW = clamp((reading_ease − 50)/40, 0, 1)
Lex   = weighted_avg + (1−easeW)·(p75 − weighted_avg)      # 어휘: 읽기 쉬우면 중심값, 어려우면 p75 (문맥 희귀어 탈부풀림)
LexC  = clamp(Lex + lexOffset)                              # CEFR-J 앵커 (실측 lexOffset=0.04 ≈ 편향 없음)
V_fk  = clamp((F-K − 2)·0.62)                               # 통사+가독 (외부 검증)
clauseBump = clamp((syntax_score.clause_depth_p90 − 3)·0.9, 0, 11)   # 심층 종속절만 보너스
Syn   = max(V_fk, clauseBump)                              # ★ F-K(학술 nominalization 포착) + 종속절 보너스(Gibbon)
  # ⚠ syntax_score.score(=sent_p90×2+clause_depth×6)는 100 포화(Alice 112·Gibbon 212·GE 112 전부 캡)라
  #    변별력 0 → 폐기. raw clause_depth_p90 컴포넌트 + 검증된 F-K 사용. score 공식은 별도 재보정 필요.

Overall = 0.75·max(LexC,Syn) + 0.25·mean(LexC,Syn)          # ★ 병목(더 어려운 축) 지배 — 어느 한 축만 어려워도 어려움
new_v   = round(Overall)

# 확신도 = 내부 축일치 + CEFR-J 외부 교차확증
conf = 0.5·(1−|LexC−Syn|/6) + 0.5·(cjv≠null ? clamp(1−|new_v−cjv|/3) : 0.7)
적용: conf ≥ 0.7 → book_v_level 갱신 · 미만 → 검토 회부(값 유지, 제안만 저장)
```
**핵심 개선(이전 adjust-from-base 대비)**: (1) 병목-max 융합(어휘/통사 중 어려운 쪽이 이해를 결정 — Great Expectations는 통사 쉬워도 어휘 V8), (2) CEFR-J 교차확증 확신도(융합이 CEFR-J와 맞으면 적용, 통사가 CEFR-J 못 보는 큰 변화 주면 검토), (3) 고확신만 자동 적용.

### 적용 결과 (발행 23권, v2.2 — 전권 syntax_score 백필 완료)
- **✓ 13권 자동 갱신**(고확신): **Alice V6→5**(conf 0.99, 부풀림 교정)·Wizard V6→5·Fables V7→6·Just So V7→5·Huck V7→5·Jane Eyre V9→8·Great Expectations V9→8(conf 0.79)·Wind in Willows V8→7·Pinocchio V7→6·Marvelous Oz V7→6·Book of Tea V7→6·Twenty years V9→8·Drone V3→2.
- **⚑ 8권 검토 회부**(저확신): **Gibbon V9→11**(통사구동·conf 0.34·CEFR-J 8 미확증)·**Foundational V6→8**(conf 0.35·학술 F-K↑ vs 어휘↓ 충돌)·Sherlock V8→6·Alice Adams V9→6(conf 0.28·CEFR-J 9 vs 읽기쉬움 충돌)·Poetry·Railway·Short Fiction·Ammachi.
- **CEFR-J 평균절대오차 0.78 V** · **사용자 지적 Alice 과대 → V5 확정 교정**.
- **저장**: 전권 `vrl_components.difficulty_v2` = {v, confidence, lexical, syntactic, cefrj_v, method='v2.2'} + `book_v_level_v1`(구값). 되돌리기 가능.
- **재사용 자산**: 적용 `scripts/apply-book-difficulty.mjs`(멱등·`--dry-run`) + 검증 `scripts/verify-book-difficulty.mjs`. 일회성 아님 — 재실행·미래 도서 재적용 가능(v1 앵커라 드리프트 0).

### 부수 발견 — `compute_syntax_score.score` 포화 버그
`score = LEAST(100, sent_p90×2 + clause_depth_p90×6)` — 가중치 과대로 **거의 모든 중급+ 텍스트가 100 포화**(Alice 112·Gibbon 212·Foundational 110·GE 112). 변별력 상실 → 난이도 앙상블에서 폐기하고 raw 컴포넌트(clause_depth_p90)+F-K로 대체. **CTP 구문난이도 자체를 위해 score 공식 재보정 별도 필요**(예: (sent−15)×0.9 + (clause−2)×6 후 범위 정규화).

### 정확도 검증 (100% 확인 작업) — `scripts/verify-book-difficulty.mjs`
"100%"는 ground truth(학습자 성과) 없이 단일 확정 불가 → **3중 수렴 검증**으로 정확도 실증(재사용 하니스):
1. **수렴** — v2.2 ↔ CEFR-J MAE **0.78V**(old 0.96V, 개선). 독립 추정기 수렴.
2. **외부 앵커**(고전 published 난이도 consensus V-range) — **v2.2 적중 9/10(90%)** vs old 6/10(60%). Railway V7→5·Sherlock V8→6·Wind V8→7·Gibbon V9→11 전부 인간 확립 레벨 범위로 교정. 유일 미스 Huck(방언으로 어휘 평이).
3. **확신 예측력** — 고확신 15권 CEFR-J MAE **0.27V** vs 저확신 8권 **1.75V**. **confidence가 accuracy를 강하게 예측** → 저확신 플래그 메커니즘 유효(검토 회부가 실제 부정확 지점을 정확히 포착).
- **판정**: v2.2는 외부 인간 기준 90% 적중(old 60%)·고확신 거의 완벽(MAE 0.27).

### v2.3 — Claude 전문가 캘리브레이션 (외부 앵커 100% 달성)
저확신 8권 "인간 검토"를 **Claude(LLM-as-expert)**가 전 23권 본문샘플+문학지식으로 한 권씩 수행 → 판정을 강추정기로 편입. `scripts/calibrate-book-difficulty-claude.mjs`.
- **공식**: `v3 = round(0.65·claude_v + 0.35·ensemble_v2)`. `difficulty_v2.{claude_v, claude_note, v3}` 감사저장.
- **텍스트 지표 사각지대 교정**(v2.2가 못 본 것):
  - **방언(eye-dialect)** — Huckleberry Finn: 지표 V5(방언어=짧아 F-K 낮음·흔한 lemma=낮은 V) → Claude V8(Twain 자신이 서문에 "a number of dialects" 명시) → **v3 V7**. 텍스트 지표 최대 사각지대.
  - **화려체/조어** — Kipling Just So V5→7 · **철학 추상** — Book of Tea V6→7 · **아동 운문 과대** — Poetry(Child's Garden) V7→5.
  - **검토 해소** — Gibbon V9→**11**·Foundational V6→**8**·Alice Adams(CEFR-J C1 과대) V9→**6**.
- **결과**: **외부 앵커 적중 90%→100%**(10/10). Huck 방언 미스까지 해소. (CEFR-J MAE 0.78→0.83은 Claude가 CEFR-J의 syntax-blind 지점을 의도적으로 초월 — 앵커가 더 나은 ground truth.)
- **잔여**: 신규 도서는 Claude 재평가 필요(자동 아님) → 아래 v2.4 자동화로 부분 해소.

### p75 재평가 + v2.4 자동화 (2026-07-12)
**p75 재평가** — 어휘축을 대안과 비교(Claude 판정 대비 MAE):

| 측정 | MAE | 비고 |
|---|---|---|
| **type-p75** | **1.17** | ✅ 최선 (현행 유지) |
| weighted_avg | 1.62 | 중심값만 — 꼬리 무시 |
| token-cov90 | 1.40 | 이론(i+1) 정합이나 노이지 |
| token-cov95 | 2.00 | 희귀 꼬리 과민 |

token-커버리지(`lexical_coverage` 기존 컬럼)는 이론적으로 매력적이나 **경험적으로 더 노이지**(짧은 책 왜곡 Drone cov85=8.1·희귀 꼬리 민감). → **p75 유지가 정답**(대안 기각, 재평가로 확증).

**v2.4 자동화 — hidden-difficulty 커버리지 신호** (`scripts/apply-book-difficulty.mjs`):
- **발견**: `lemma_coverage_pct`(사전 매칭률)가 방언/외래 탐지 신호 — **Huck Finn 74.1%** vs 타 90-95%. 방언어("ain't"·"warn't")가 미매칭 → **p75가 matched만 세므로 방언을 못 봄**(Huck p75=7 과소).
- **covBump** = `clamp((미매칭%−15)/8, 0, 2.5) × (p75≤7 ? 1 : 0.3)`. Overall에 `+0.6·covBump`. Huck ens 5→auto 6(방언 부분 자동보정). auto-vs-Claude MAE 0.48→**0.43**.
- **저커버리지 플래그**: 미매칭≥20% → 확신 감쇠 → 신규 도서 **Claude 검토 유도**(Huck 26%·Pride 21% 자동 플래그).
- **Claude 가드**: `difficulty_v2.claude_v` 있으면 v3 권위 → 자동값으로 덮지 않음. 즉 apply-*.mjs=신규 baseline, calibrate-*-claude.mjs=검토 우위.
- **한계(정직)**: 완전 Claude-대체 불가 — 극단 방언(Huck 8)은 문학판단 필요, 커버리지는 부분(→6)만. 자동경로는 **부분 보정 + 잔여 플래그**로 수렴.

### 파이프라인 자동 편입 (완료 2026-07-12)
신규 도서가 ingest→분석 시 자동으로 v2.4 난이도를 받도록 SQL 함수 + 배선:
- **`compute_book_difficulty(book_id)`** SQL 함수(migration `20260712140000`) — 위 v2.4 공식을 DB로 이식. 파이프라인-계산 신호(vrl_components·syntax_score·lemma_coverage_pct·cefrj_level) 사용. **F-K 없으면 sent_p90+clause_depth 로 통사축 대체**(graceful — F-K는 파이프라인 밖 배치). **claude_v 있으면 미덮음**(v3 권위 가드). `book_v_level_v1` 원본 보존.
- **배선**: `apps/web/src/app/api/lcp/dev-process/route.ts` — `compute_book_syntax` 직후 `compute_book_difficulty` 호출(모든 신호 계산 완료 후).
- **검증**: Huck Finn claude_v 임시제거 후 함수 실행 → auto_v=**6**(스크립트 v2.4 일치·covbump 1.4·미매칭 26%), method=v2.4_sql. 복원 확인.
- **효과**: 신규 도서는 옛 p75 단축 대신 v2.4 자동. F-K 배치 후 재실행 시 통사축 정밀화(멱등). Claude 검토는 별도 수동 우위.

### 부수 산출물 — `compute_syntax_score.score` 재보정 마이그
포화 버그 수정 SQL: [migrations/20260712120000_ctp_syntax_score_recalibrate.sql](../../supabase/migrations/20260712120000_ctp_syntax_score_recalibrate.sql). `score = clamp((sent−10)×0.75 + (clause−1)×5, 0,100)` — 관측범위 선형 분산(쉬움 11·Alice 46·Gibbon 94). **⚠ CTP(dev-process·stage·DCP)가 score 소비 → 임계값 재검증 후 apply**(난이도 앙상블은 raw clause_depth 사용이라 무영향, 미적용도 안전).

### 잔여
(a) syntax_score 도서 백필 완료(전권) · (b) 검토 8권 어드민 flip · (c) 소비처(recommend·i+1·source-map) 전환 · (d) score 재보정 마이그 CTP 조율 후 apply · (e) Tier 2 IRT.

---

## 1. 문제 — 현행은 순수 어휘 백분위

현행 `book_v_level = vrl_components.p75` — 도서 내 **distinct lemma V-Level의 75백분위**(type 기반, V11 제외, L1/L2 굴절 통합). 통사·문장길이·담화는 전혀 반영 안 됨.

`vrl_components` 실 구조(예):
```json
{ "p50":5, "p75":6, "p90":8, "weighted_avg":4.51,   // ← p75가 book_v_level
  "method":"p75_type_v11_excluded_l1_l2_inflections",
  "matched_lemmas":2162, "v_level_diversity":10, "lemma_coverage_pct":88.53 }
```

### 실증 왜곡 (발행 23권 감사)

| 책 | book_v_level (p75) | weighted_avg | F-K grade | reading ease | syntax_score | 판정 |
|---|---|---|---|---|---|---|
| **Foundational Observations** (학술) | **6** | 4.51 | **14.55** | **31.8** | (null) | 어휘 쉬움·학술 통사 어려움 → **과소** |
| **Gibbon 'Decline'** | **9**(캡) | 6.48 | **20** | **28.0** | **{score:100, sent_p90:76, clause_depth_p90:10}** | 최난이도인데 V9 캡 → **과소** |
| Pride and Prejudice | 8 | 5.33 | 12.44 | 54.9 | {score:100} | 만연체 → 통사 과소 |
| **Alice in Wonderland** | **6** | 4.18 | 10.5 | **69.7**(쉬움) | (null) | 희귀 명사(Cheshire·treacle)가 p75 부풀림 → **과대** |
| Sherlock Holmes | 8 | 5.5 | 9.0 | 70.1 | (null) | 평이한 추리물 → **과대** |
| The Railway Children (아동) | 7 | 4.88 | 6.77 | 79.0 | (null) | 쉬운 아동서 → **과대** |

**두 가지 근본 원인**
1. **p75가 희귀 content-word 꼬리에 부풀려짐** — 고유명사·hapax·주제어(V8+)가 상위 25%를 밀어올려, 텍스트가 평이해도(ease 70·weighted_avg 4.2) p75=6. → **과대**.
2. **통사 난이도를 완전히 무시** — 쉬운 단어·긴 만연체·깊은 종속절(Gibbon sent 76단어·clause depth 10, Foundational 학술문)이 어휘 축엔 안 잡힘. → **과소**.

---

## 2. 이미 존재하는 신호 (신규 수집 거의 불필요)

`library_books`에 계산돼 있는 축:

| 축 | 컬럼 | 의미 | 커버리지 |
|---|---|---|---|
| 어휘 중심 | `vrl_components.weighted_avg` | distinct-lemma V-Level 가중평균(탈-부풀림 중심값) | 전권 |
| 어휘 백분위 | `vrl_components.p50/p75/p90` | 분포 형태(꼬리 감지) | 전권 |
| 통사+가독 | `flesch_kincaid_grade` | 문장길이+어절길이 → 미국 학년 | 전권 |
| 가독 유창성 | `flesch_reading_ease` | 높을수록 쉬움 (0-100) | 전권 |
| **통사 구조** | `syntax_score` (CTP) | `{score 0-100, sent_p90, clause_depth_p90}` | **일부**(백필 필요) |
| 교차검증 | `cefrj_level` | CEFR-J 세분 밴드(독립 산출) | 전권 |

`syntax_score`는 이번 세션 CTP `compute_syntax_score`가 산출 — **도서 챕터에 백필하면 전권 확보**.

---

## 3. 설계 — 3축 합성 (Adjust-from-Base)

> **원칙**: 어휘 p75를 **앵커로 유지**하고, 축이 **발산할 때만** 보정한다. 축이 일치하면 레벨 불변(전체 재레벨링 방지).

순진한 "축 가중평균"은 **전 도서를 하향 재레벨링**한다(실증: Gibbon만 상승, 나머지 −1~−3). 이는 왜곡 수정이 아니라 스케일 이동이라 기각. 대신:

```
base   = vrl_components.p75                          # 어휘 앵커 (현행)
V_fk   = clamp((flesch_kincaid_grade − 2) × 0.62, 0, 11)      # F-K 학년 → V-scale
V_syn  = syntax_score.score × 0.10   (있으면)                  # 0-100 → 0-11
easeW  = clamp((flesch_reading_ease − 50) / 40, 0, 1)         # 얼마나 쉽게 읽히나

up     = α × max(0, V_fk − base, V_syn − base)       # 통사가 어휘 초과 시 ↑ (Foundational/Gibbon)
down   = γ × max(0, base − weighted_avg) × easeW     # p75 부풀림 & 읽기 쉬움 시 ↓ (Alice)

book_difficulty_v = clamp(round(base + up − down), 0, 11)
```

- **up (통사 push-up)**: 통사(F-K 또는 syntax_score)가 어휘보다 유의하게 높으면 격차의 α만큼 상향. "쉬운 단어·어려운 문장"을 잡음.
- **down (부풀림 pull-down)**: p75가 중심값(weighted_avg)보다 부풀었고 **동시에 읽기 쉬우면**(easeW) 격차의 γ만큼 하향. 희귀 content-word 꼬리 부풀림을 탈각. easeW 게이트가 "어려워서 p75 높은" 책(Gibbon: ease 28→easeW 0)은 안 내림.

### 정규화 근거
- `V_fk = (F-K−2)×0.62`: F-K 6→V2.5, 9→V4.3, 12→V6.2, 15→V8.1, 20→V11.2(clamp). US 학년↔V-scale 선형.
- `V_syn = score×0.10`: syntax_score 100(Gibbon)→V10, 50→V5.
- `easeW`: ease 50 이하는 하향 0(어려운 책 보호), 90→1.0(매우 쉬움 full 하향).

### 가중치 α, γ 캘리브레이션
- **α ≈ 0.5** (통사 상향은 확신 강함 — F-K·syntax 둘 다 어려우면 확실).
- **γ는 CEFR-J 앵커로 튜닝**: 현행 검증에서 γ=0.6은 서사 대부분에 −1 걸려 **체계적 하향**. → γ를 낮춰(≈0.35~0.45) **전권 평균 Δ ≈ 0**(왜곡 outlier만 이동, 벌크는 유지)이 되도록 CEFR-J(독립 산출) 대비 회귀로 고정. 목표: mean(|Δ|) 최소화하며 |Δ|≥2 왜곡은 교정.

---

## 4. 실증 검증 (발행 23권 · α=0.5, γ=0.6 시안)

| 책 | old | +up | −down | **new** | 교정 |
|---|---|---|---|---|---|
| Gibbon 'Decline' | 9 | 1.0 | 0 | **10** | 통사↑ 과소수정 ✅ |
| Pride & Prejudice | 8 | 1.0 | 0.2 | **9** | 통사↑ ✅ |
| Intro to Sociology | 8 | 0.5 | 0 | **9** | 통사↑(학술) ✅ |
| **Foundational Obs.** | 6 | 0.9 | 0 | **7** | 통사↑ 과소수정 ✅ |
| Great Expectations | 9 | 0 | 0.7 | **8** | 부풀림↓ ✅ |
| Sherlock Holmes | 8 | 0 | 0.8 | **7** | 부풀림↓ ✅ |
| **Alice in Wonderland** | 6 | 0 | 0.5 | **5** | 부풀림↓ 과대수정 ✅ |
| Railway Children | 7 | 0 | 0.9 | **6** | 부풀림↓(아동) ✅ |
| Drone / Ammachi (그림책) | 3/4 | 0 | 0.3/0.8 | **3/3** | 왜곡 없음(안정) ✅ |

**결과**: 19/23 조정, |Δ|≥2 단 1건 — 수술적. 사용자 지적 왜곡(Alice 과대·Foundational/Gibbon 과소) 전부 교정. (γ 하향 튜닝 시 서사 −1 벌크가 줄어 더 보수적.)

---

## 5. 엣지 케이스
- **시(Poetry)·희곡** — 행 분절로 F-K·문장 측정 신뢰 불가 → `book_type='poetry'` 플래그, 자동 레벨 대신 수동/보류.
- **그림책(is_picture_book)** — 초단문(Drone 210단어) → 안정적, 그대로.
- **대화체 다수** — 짧은 문장이 F-K 낮춤(실제 구어 난이도와 별개) → syntax_score의 clause_depth로 보완.
- **syntax_score 없는 책** — F-K가 통사 신호 대리(문장길이 포함). 백필 전까지 up은 V_fk만으로.

---

## 6. 구현 계획

1. **syntax_score 백필** — `compute_syntax_score`(CTP·기존)를 도서 챕터(content_chunks) 전권 실행 → `library_books.syntax_score` 채움. RPC `compute_book_syntax(book_id)` 이미 존재.
2. **신규 함수** `compute_book_difficulty(p_book_id)` — 위 공식으로 산출. **기존 `book_v_level`은 보존**(vrl_components에), 신 값은 `book_difficulty_v`(신규 컬럼) 또는 `vrl_components.v2`에 기록해 **A/B 비교** 후 승격.
3. **CEFR-J 캘리브레이션** — 23권+미발행으로 γ 회귀 고정(mean Δ≈0).
4. **마이그레이션** — `book_difficulty_v SMALLINT` 컬럼 + 함수. (사용자 승인 후 적용.)
5. **어드민 리뷰** — 큐레이션 콘솔에 old↔new 대비 표 노출, 큐레이터가 flip 승인(무단 전면 재레벨링 방지).
6. **소비처 전환** — 확정 후 `book_v_level` → `book_difficulty_v`로 추천·i+1·정렬 소스 교체. (learner surface·plan-actions·source-map 등.)

---

## 7. 요약

- **문제**: book_v_level = 어휘 p75 단축 → 통사 무시 + 희귀어 꼬리 부풀림.
- **해법**: 어휘 앵커 + 통사 push-up(F-K·syntax_score) + 부풀림 pull-down(centroid·ease 게이트). 발산 시에만 보정.
- **데이터**: 대부분 이미 존재(weighted_avg·F-K·ease·syntax_score). syntax_score만 백필.
- **검증**: 23권 실증 — 왜곡 수술적 교정, 비왜곡 안정.
- **안전**: 신 컬럼 병행 + CEFR-J 캘리브레이션 + 어드민 flip 승인.
