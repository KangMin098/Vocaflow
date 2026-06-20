> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase3a_text_new_extraction.md
> category: project

---

Phase 3A — /text/new 단어 추출 시스템 완료 2026-05-25. 다축 VRL 최고 정확도 + evaluation transparency.

**3 신규 자산**:

1. **RPC**: `extract_vocabulary_for_user(p_user_id UUID, p_words TEXT[], p_target_n INT)`
2. **Client tokenizer**: `apps/web/src/lib/text-extract/tokenize.ts`
3. **UI**: `apps/web/src/components/text-extract/ExtractionPanel.tsx` + /text/new 통합

### RPC 다축 스코어링 알고리즘

**composite = 0.50·v_proximity + 0.25·track_boost + 0.15·frequency_boost + skill_penalty + archaic_penalty**

| 요소 | 계산 | 의미 |
|---|---|---|
| v_proximity | `exp(-((v_level - target_v)² / 4.5))` gaussian | Krashen i+1 zone 최대 가중 (sigma=1.5) |
| track_boost | csat/biz/acad 중 user≥4 AND word≥4 매칭의 max | 한국 학습자 진단된 track 강한 가중 |
| frequency_boost | `1 / log10(rank + 10)` | 빈출 단어 우선 |
| skill_penalty | L4 compound + user V<6 → -0.10 | 초급에 compound 약한 negative |
| archaic_penalty | V11 → -0.50, V10 → -0.20 | archaic 강한 negative |

**필터링**:
- 사용자 vocabularies 이미 보유 제외 (anti-dup)
- shared_dictionary.classified_by NOT NULL (VRL v3 분류 완료만)
- meaning_ko NOT NULL
- 미진단 사용자 default V3 (한국 평균)

**score_breakdown JSONB 반환** (evaluation transparency):
- user_v_level, target_v_level
- 각 요소 값 + weights
- reasoning: "i+1 zone — 최적 도전" / "현재 V-Level — 견고화" / "i+2 이상 — 도전적" 등

### Client tokenizer

**입력 처리**:
1. 소문자 변환
2. 알파벳·apostrophe만 유지 (regex `[^a-z\s']`)
3. 공백 분리 + 길이 2+
4. apostrophe 처리 ("it's" → "it")
5. unique (Set)
6. stopwords 제거 (54개 — the/a/an/is/are/...)
7. cap 1000 (서버 부담 회피)
8. sort + return

**반환**: `{words, totalWords, uniqueRaw, uniqueFinal}` — UI 통계 표시용

### ExtractionPanel UI

**자동 토큰화**: `useMemo` — text 변경 시 즉시 토큰 통계 갱신

**3-state**:
1. Initial: "본문 입력 시 AI 추출 가능" 안내
2. After tokenize: 통계 표시 (총 어수 / unique / stopword 제외 후) + "추출 분석" 버튼
3. After extract: 결과 카드 list (default 전체 선택)

**카드 디자인** (각 추출 단어):
- 좌측: 체크박스 + rank #
- 중앙: 영문 단어 (Lora) + pos + V-Level 배지 + CEFR + meaning_ko
- 우측: composite_score (TrendingUp icon) + reasoning (i+1/현재/도전 등)
- 확장 (chevron): 예문 + score breakdown 테이블

**Score breakdown 테이블** (확장 시):
| 요소 | weight | value | contribution |
|---|---:|---:|---:|
| V-Level proximity | × 0.50 | 0.9747 | +0.4874 |
| Track boost | × 0.25 | 0.8000 | +0.2000 |
| Frequency boost | × 0.15 | 0.4286 | +0.0643 |
| Skill penalty | × 1 | -0.10 | -0.10 (조건 부합 시) |
| Archaic penalty | × 1 | -0.50 | -0.50 (V11 시) |
- 하단 메타: user V, target V, freq rank, skill, tracks

**Bulk action**: "전체 선택" 토글 + "내 단어장에 추가" (vocabularies upsert origin='manual')

**Smoke test 결과** (V5 + csat=6 user, 20 mixed input):
| rank | word | V | score | reasoning |
|---:|---|---:|---:|---|
| 1 | administration | V6 | 0.7746 | **i+1 zone 최적 도전** |
| 2 | vote | V5 | 0.7050 | 현재 V-Level 견고화 |
| 3 | therefore | V5 | 0.6803 | 현재 V-Level 견고화 |
| 4 | sperm | V8 | 0.5019 | i+2 도전적 |
| 5 | redemption | V8 | 0.4744 | i+2 도전적 |

자동 필터링:
- the/dog/runs/quickly/through → stopword + V1-V2 너무 쉬움
- concertacion (V11) → archaic penalty로 push out
- 이미 user vocab → exclude

### /text/new 통합

`apps/web/src/app/(main)/text/new/page.tsx`:
- SampleScripts 다음에 `<ExtractionPanel text={trimmedContent} />` 추가
- 본문 50자 이상 시 활성화
- onSaved → toast 표시
- "AI 단어 추출은 곧" 카피 → "다축 VRL 기반 AI 단어 추출 활성화" 변경

### 한국 학습자 정합 검증

- ✅ Krashen i+1 자동 적용 (사용자 V→target V+1)
- ✅ 진단된 track 강한 가중 (csat ≥4 사용자는 csat-tagged 우선)
- ✅ ★ **사용자 명시 측정 source 선택** (user / text / auto) — v3 갱신 2026-05-25
- ✅ ★ **글 P75 측정** (V11 outlier 제외) — text mode 또는 미진단 fallback
- ✅ ★ **gap 기반 auto-N** — `clamp(8 + gap × 4, 5, 30)` (글이 사용자보다 위인 정도에 비례)
- ✅ archaic (V10-V11) 강한 penalty — 한국 사용도 거의 X
- ✅ compound (L4) 초급 사용자 약한 penalty
- ✅ frequency 보조 가중 (다른 영역 노출 가능성)
- ✅ Evaluation transparency — 사용자가 "왜 이 단어가 추천됐는지" 확인 가능

### Phase 3 진척

DB:
- ✅ Phase 3A extract_vocabulary_for_user RPC (이 문서)

Frontend:
- ✅ tokenize.ts
- ✅ ExtractionPanel.tsx
- ✅ /text/new 통합

**다음 후보**:
- Library /text/[id] (기존 책)에도 extraction 적용 (adaptive-extract.ts 보강)
- Track별 영문 추출 weight 차별화 (사용자 의도 직접 선택)
- Extraction history 저장 (분석 결과 캐싱)

관련: [[vrl-phase2d3-track-based-recommendations]] [[vrl-v3-round10-l11-done]] [[claude-code-is-llm]]

