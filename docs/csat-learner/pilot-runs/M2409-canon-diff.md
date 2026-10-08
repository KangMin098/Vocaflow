# M2409 정본 저장 전 diff — 현재 DB(유형 기본값 시드) → 최종 태그(tri-model adjudicated)

> 생성 2026-10-08 · `scripts/csat/diagnosis/canon-prepare.mts`(DB 읽기만). 현재 DB: 역량 행 78 · 검수 표지 0 · diagnosis_ready=false.
> 최종 태그 출처: Claude Code(Opus) · Codex · 3차 Claude Sonnet 서브에이전트(블라인드 — 원문 · 정의 · 계약만, 기존 판정 · 순위 · 목표 숨김). 규칙: 두 판정이 존재(0 vs >0)에서 갈린 22칸만 3차 판정. 존재 = 3 중 2 이상 > 0 · 값 = 세 값의 중앙값. 3차가 정의 해석에 달렸다고 표시한 칸 = taxonomy_ambiguous(값은 계산하되 taxonomy 결정 근거로 쓰지 않음). 나머지 칸은 두 판정 일치값(가중치 갈림은 작은 값 — 이중 검수 규칙 그대로). 상태: tri-model adjudicated — human verified 아님.
> 축 관측 계약(axis-routing): R · E 기출 관측 · V · X 보조(구분 확인) · S 직접 확인 · L 범위 밖 — 정본은 「모든 축을 기출로 판정」이 아니다.
> 저장 방법(승인 뒤): 관리자 태깅 화면 「검수 저장」 = `csat_dx_save_item_tagging`(문항마다 9개 · 0 포함) → 판정 28/28 · 252행 · 구조 0 확인 → 관리자 「진단 반영 켜기」. 직접 UPDATE 금지.
요약: 28문항 중 현재 DB 와 다른 문항 22 · 저장 후 행 252(9 × 28) · 검수 표지 28문항.

> 굵은 글씨 = 현재 DB 와 다른 역량.

### 18번
- 현재 DB: **A1:1** A2:0 **A3:1** A4:1 **A5:1** A6:0 A7:0 A8:0 A9:0
- 저장할 값: **A1:0** A2:0 **A3:0** A4:1 **A5:2** A6:0 A7:0 A8:0 A9:0
- Claude: A1:0 A2:0 A3:1 A4:1 A5:2 A6:0 A7:0 A8:0 A9:0
- Codex: A1:0 A2:0 A3:0 A4:1 A5:2 A6:0 A7:0 A8:0 A9:0
- 3차(A3): 0 → 최종 0(존재 아니오) — The purpose is stated directly (we are asking for parent volunteers); no inter-sentence logic is needed to pick option 1.

### 19번
- 현재 DB: **A1:2** A2:0 A3:0 A4:0 A5:1 A6:0 A7:0 A8:0 A9:0
- 저장할 값: **A1:1** A2:0 A3:0 A4:0 A5:1 A6:0 A7:0 A8:0 A9:0
- Claude: A1:2 A2:0 A3:1 A4:0 A5:1 A6:0 A7:0 A8:0 A9:0
- Codex: A1:1 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:0
- 3차(A3): 0 → 최종 0(존재 아니오) — The before/after shift (canceled trip, then the zoo news) is explicit and the emotion words are overt, so a miss would point to A1 or mood vocabulary, not flow.

### 20번
- 현재 DB: A1:0 A2:0 A3:1 A4:2 **A5:1** A6:0 A7:0 A8:0 A9:0
- 저장할 값: A1:0 A2:0 A3:1 A4:2 **A5:0** A6:0 A7:0 A8:0 A9:0
- Claude: A1:0 A2:0 A3:2 A4:2 A5:1 A6:0 A7:0 A8:0 A9:0
- Codex: A1:0 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A5): 0 → 최종 0(존재 아니오) — The claim is stated repeatedly (willing to let fear be present, step into fear); no single evidence sentence has to be located, so a miss would point to A4.

### 21번
- 현재 DB: A1:1 **A2:1** **A3:0** A4:2 A5:0 **A6:1** A7:0 A8:0 A9:0
- 저장할 값: A1:1 **A2:0** **A3:1** A4:2 A5:0 **A6:0** A7:0 A8:0 A9:0
- Claude: A1:1 A2:1 A3:0 A4:2 A5:0 A6:1 A7:0 A8:0 A9:0
- Codex: A1:1 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A2): 0 → 최종 0(존재 아니오) — The sentences are long, with dashes and appositives, but the gist (extra quality that adds no value is undesirable) survives partial parsing; A2 alone would not likely cause a miss.
- 3차(A3): 1 → 최종 1(존재 예) — The student must link the closing saying back to the gold-plating argument (more than needed does not add value). Failing this link alone could plausibly produce a wrong pick, but the link is not strong enough to move a recommendation.
- 3차(A6): 0 → 최종 0(존재 아니오) · **taxonomy_ambiguous** — The passage defines gold plating itself, so no outside knowledge is required; this depends on reading A6 as brought-in knowledge, not context the passage supplies.

### 22번
- 현재 DB: A1:0 A2:0 A3:1 A4:2 **A5:1** A6:0 A7:0 A8:0 A9:0
- 저장할 값: A1:0 A2:0 A3:1 A4:2 **A5:0** A6:0 A7:0 A8:0 A9:0
- Claude: A1:0 A2:0 A3:1 A4:2 A5:1 A6:1 A7:0 A8:0 A9:0
- Codex: A1:1 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A1): 0 → 최종 0(존재 아니오) — Words like assimilation and multiculturalists are glossed by context, and the answer rests on the right to keep one's culture, not on a vocabulary item.
- 3차(A5): 0 → 최종 0(존재 아니오) — The gist sits in the last third (recognize other cultures have the right to differ), but gist items are main-idea tasks and a miss does not show an evidence-location deficit.
- 3차(A6): 0 → 최종 0(존재 아니오) · **taxonomy_ambiguous** — The passage supplies the immigration history, so no outside knowledge is needed; this depends on the definition of A6 as brought-in knowledge.

### 23번
- 현재 DB: A1:1 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 저장할 값: A1:1 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- Claude: A1:1 A2:0 A3:2 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- Codex: A1:1 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0

### 24번
- 현재 DB: **A1:0** A2:0 A3:1 A4:2 A5:0 **A6:1** A7:0 A8:0 A9:0
- 저장할 값: **A1:1** A2:0 A3:1 A4:2 A5:0 **A6:0** A7:0 A8:0 A9:0
- Claude: A1:1 A2:0 A3:1 A4:2 A5:0 A6:1 A7:0 A8:0 A9:0
- Codex: A1:1 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A6): 0 → 최종 0(존재 아니오) · **taxonomy_ambiguous** — The passage explains the web-archive point itself, so no outside knowledge is needed; this depends on the definition of A6.

### 25번
- 현재 DB: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 **A9:1**
- 저장할 값: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 **A9:0**
- Claude: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:1
- Codex: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:0
- 3차(A9): 0 → 최종 0(존재 아니오) · **taxonomy_ambiguous** — Checking five statements against a table takes time, but time pressure is not an item-level diagnostic cause here; whether A9 applies to chart items at all is a definitional question.

### 26번
- 현재 DB: A1:0 **A2:1** A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:0
- 저장할 값: A1:0 **A2:0** A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:0
- Claude: A1:0 A2:1 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:0
- Codex: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:0
- 3차(A2): 0 → 최종 0(존재 아니오) — The sentences are simple. Option 5 conflicts with the last sentence (continued to perform), which is a content match, not a structure problem.

### 27번
- 현재 DB: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 **A9:1**
- 저장할 값: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 **A9:0**
- Claude: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:1
- Codex: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:0
- 3차(A9): 0 → 최종 0(존재 아니오) · **taxonomy_ambiguous** — A short notice that is quick to check (weekdays vs weekend); whether A9 applies to short single items is a definitional question.

### 28번
- 현재 DB: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 **A9:1**
- 저장할 값: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 **A9:0**
- Claude: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:1
- Codex: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:0
- 3차(A9): 0 → 최종 0(존재 아니오) · **taxonomy_ambiguous** — A short notice with direct lookups (note: students select photos); whether A9 applies to short single items is a definitional question.

### 29번
- 현재 DB: A1:0 A2:1 A3:0 A4:0 A5:0 A6:0 A7:0 A8:2 A9:0
- 저장할 값: A1:0 A2:1 A3:0 A4:0 A5:0 A6:0 A7:0 A8:2 A9:0
- Claude: A1:0 A2:2 A3:0 A4:0 A5:0 A6:0 A7:0 A8:2 A9:0
- Codex: A1:0 A2:1 A3:0 A4:0 A5:0 A6:0 A7:0 A8:2 A9:0

### 30번
- 현재 DB: A1:2 A2:0 **A3:1** A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- 저장할 값: A1:2 A2:0 **A3:2** A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- Claude: A1:2 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- Codex: A1:2 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0

### 31번
- 현재 DB: **A1:1** **A2:1** **A3:2** A4:2 A5:0 **A6:1** A7:0 A8:0 A9:0
- 저장할 값: **A1:2** **A2:0** **A3:1** A4:2 A5:0 **A6:0** A7:0 A8:0 A9:0
- Claude: A1:2 A2:0 A3:1 A4:2 A5:0 A6:1 A7:0 A8:0 A9:0
- Codex: A1:2 A2:0 A3:2 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A6): 0 → 최종 0(존재 아니오) · **taxonomy_ambiguous** — The blank is inferred from the passage (home-centered leisure, free TV), so no outside knowledge is needed; this depends on the definition of A6.

### 32번
- 현재 DB: A1:1 **A2:1** A3:2 A4:2 A5:0 **A6:1** A7:0 A8:0 A9:0
- 저장할 값: A1:1 **A2:0** A3:2 A4:2 A5:0 **A6:0** A7:0 A8:0 A9:0
- Claude: A1:1 A2:0 A3:2 A4:2 A5:0 A6:1 A7:0 A8:0 A9:0
- Codex: A1:1 A2:0 A3:2 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A6): 0 → 최종 0(존재 아니오) · **taxonomy_ambiguous** — The cat example inside the passage settles the answer (tags leave out what is happening), so no outside knowledge is needed; this depends on the definition of A6.

### 33번
- 현재 DB: **A1:1** **A2:1** A3:2 A4:2 A5:0 **A6:1** A7:0 A8:0 A9:0
- 저장할 값: **A1:0** **A2:0** A3:2 A4:2 A5:0 **A6:0** A7:0 A8:0 A9:0
- Claude: A1:1 A2:0 A3:2 A4:2 A5:0 A6:1 A7:0 A8:0 A9:0
- Codex: A1:0 A2:0 A3:2 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A1): 0 → 최종 0(존재 아니오) — The options use plain phrases (caught up, regained acceptance); a miss would come from inference or paraphrase, not word meaning.
- 3차(A6): 0 → 최종 0(존재 아니오) · **taxonomy_ambiguous** — The passage retells the Mendel story, so knowing genetics is unnecessary; this depends on the definition of A6.

### 34번
- 현재 DB: A1:1 **A2:1** A3:2 A4:2 A5:0 **A6:1** A7:0 A8:0 A9:0
- 저장할 값: A1:1 **A2:0** A3:2 A4:2 A5:0 **A6:0** A7:0 A8:0 A9:0
- Claude: A1:1 A2:0 A3:2 A4:2 A5:0 A6:1 A7:0 A8:0 A9:0
- Codex: A1:1 A2:0 A3:2 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A6): 0 → 최종 0(존재 아니오) · **taxonomy_ambiguous** — The passage supplies the painting-vs-photography contrast (hard to transport vs mass circulation) and the answer follows from it; this depends on the definition of A6.

### 35번
- 현재 DB: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- 저장할 값: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- Claude: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- Codex: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0

### 36번
- 현재 DB: A1:0 **A2:1** A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- 저장할 값: A1:0 **A2:0** A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- Claude: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- Codex: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0

### 37번
- 현재 DB: A1:0 **A2:1** A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- 저장할 값: A1:0 **A2:0** A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- Claude: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- Codex: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0

### 38번
- 현재 DB: A1:0 **A2:1** A3:2 **A4:0** A5:0 A6:0 A7:0 A8:0 A9:0
- 저장할 값: A1:0 **A2:0** A3:2 **A4:1** A5:0 A6:0 A7:0 A8:0 A9:0
- Claude: A1:0 A2:0 A3:2 A4:1 A5:0 A6:0 A7:0 A8:0 A9:0
- Codex: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A4): 1 → 최종 1(존재 예) — The given sentence's microlevel access is a rewording of millisecond precision from the first sentence. Failing to see that rewording could plausibly cause a miss, but the main evidence is sequence and reference (A3), so only secondary.

### 39번
- 현재 DB: A1:0 **A2:1** A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- 저장할 값: A1:0 **A2:0** A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- Claude: A1:0 A2:0 A3:2 A4:1 A5:0 A6:0 A7:0 A8:0 A9:0
- Codex: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A4): 0 → 최종 0(존재 아니오) — Placement depends on the connective flow (all that is required, This is because, Critics are interested), not on matching paraphrases between the passage and an option.

### 40번
- 현재 DB: **A1:1** A2:0 A3:0 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 저장할 값: **A1:2** A2:0 A3:0 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- Claude: A1:2 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- Codex: A1:2 A2:0 A3:0 A4:2 A5:0 A6:0 A7:0 A8:0 A9:0
- 3차(A3): 0 → 최종 0(존재 아니오) — The summary needs the gist (lack of evidence yet enriches understanding) and vocabulary pairing for the blanks; it does not hinge on inter-sentence logic.

### 41번
- 현재 DB: A1:0 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:1
- 저장할 값: A1:0 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:1
- Claude: A1:0 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:1
- Codex: A1:0 A2:0 A3:1 A4:2 A5:0 A6:0 A7:0 A8:0 A9:1

### 42번
- 현재 DB: A1:2 A2:0 **A3:1** A4:0 A5:0 A6:0 A7:0 A8:0 A9:1
- 저장할 값: A1:2 A2:0 **A3:2** A4:0 A5:0 A6:0 A7:0 A8:0 A9:1
- Claude: A1:2 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:1
- Codex: A1:2 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:1

### 43번
- 현재 DB: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:1
- 저장할 값: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:1
- Claude: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:1
- Codex: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:1

### 44번
- 현재 DB: A1:0 **A2:1** **A3:1** A4:0 A5:0 A6:0 A7:0 A8:0 A9:1
- 저장할 값: A1:0 **A2:0** **A3:2** A4:0 A5:0 A6:0 A7:0 A8:0 A9:1
- Claude: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:1
- Codex: A1:0 A2:0 A3:2 A4:0 A5:0 A6:0 A7:0 A8:0 A9:1

### 45번
- 현재 DB: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:1
- 저장할 값: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:1
- Claude: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:1
- Codex: A1:0 A2:0 A3:0 A4:0 A5:2 A6:0 A7:0 A8:0 A9:1
