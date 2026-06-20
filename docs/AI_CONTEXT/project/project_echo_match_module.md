> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_echo_match_module.md
> category: project

---

EchoMatch (Shadow Reading) 모듈 — Vocaflow workspace 의 음성 학습 모듈. ModePills 의 '따라읽기' 입력 그룹 모드.

**Why:** 사용자 명시 spec 으로 진행 — 일반적으로 over-spec 차단 정책 적용하나 사용자 "일단 아래 지시사항대로 진행" 명시. 학습 효과 근거 (Shadowing - Tamai 1997, Imitation - Bohn & Munro 2007, Phonological Loop - Baddeley 2000).

**위치**: `/text/[id]/echo` 별도 라우트. ModePills 의 `shadow` 모드만 별도 라우트 (다른 모드는 `?mode=key` query).

**4-Phase 사이클**:
- idle → listening (Web Speech TTS) → recording (MediaRecorder) → comparing (DTW) → scored (3축 점수)

**파일 구조**:
- `lib/echo/`: pitch-extractor.ts · dtw-comparator.ts · audio-recorder.ts · tts-player.ts · sentence-splitter.ts · save-attempt.ts
- `components/echo/`: EchoMatchPlayer · MicPermissionGate · PhaseProgress · SentenceCarousel · PitchVisualizer · ScoreCard

**DB**: `echo_match_sessions` (세션 메타 + 평균 점수 통계) + `echo_match_attempts` (문장별 시도 + 3축 점수). RLS own 정책.

**라이브러리**: pitchfinder (YIN 알고리즘) + dynamic-time-warping-ts. 모든 client-side 처리 — 서버 부하 0.

**3축 점수 공식**:
- pitch: 100 × (1 - DTW평균거리/PITCH_THRESHOLD(80Hz))
- energy: 100 × (1 - DTW평균거리/ENERGY_THRESHOLD(0.08 RMS))
- timing: 100 × (1 - |1-ratio|/(MAX_DURATION_RATIO-1=1.5))
- overall = pitch×0.4 + energy×0.3 + timing×0.3

**알려진 한계**:
1. ~~Web Speech API TTS 출력 직접 audio 추출 불가~~ **해결됨 (v06.33 후속)** — Piper WASM (`@mintplex-labs/piper-tts-web`) 통합. 100% client-side TTS, 첫 사용 시 ~17MB 모델 다운로드 (en_US-amy-medium) + OPFS 자동 캐싱. AudioBuffer 직접 분석 가능 → synthetic ref 완전 제거. `lib/echo/piper-tts.ts` (`ensurePiperSession` + `piperSynthesize` + progress callback). EchoMatchPlayer 에 `refCacheRef` 추가 (sentence id 별 reference audio + contour 캐시, 재시도 시 재합성 X). 마이크 권한 후 background lazy preload + progress UI.
2. DTW threshold (80Hz / 0.08) PoC 후 사용자 베타 데이터로 보정 필요.
3. DTW Web Worker 미적용 (22 문장 챕터는 main thread OK · 100+ 문장에서 분리 필요).
4. iOS Safari 실 검증 미수행 — 권장: 첫 베타 사용자 모바일 검증.
5. Piper voice 선택 UI 미구현 — 현재 `en_US-amy-medium` 고정 (Phase 2: en_US-ryan-high · en_GB-alan-medium 등 voice picker).

**학습 모델 정합 정정**:
- Spec 주장 'L5 Conquer 계층' = **잘못된 매핑** (L5 = ScriptQuiz · CLAUDE.md §17)
- 실제 인지 = L4c (청각 → 음운 출력) — Dictation L6 (청각 → 타이핑) 의 음운+발화 쌍둥이
- 학습 모델 9계층 어디에도 Shadow Reading 명시 매핑 없음 — 향후 학습 모델 확장 시 명시 권고

**How to apply**:
- 본 모듈은 사용자 명시 결정으로 풀 구현 — 일반적인 stub > PoC > 풀 모듈 우선순위 정책 예외
- Phase 2 작업 시점 (사용자 베타 누적 후): synthetic reference → 사전 녹음 audio · threshold 보정 · iOS 검증 · Web Worker · Dashboard 통계 카드
- 향후 모듈 추가 spec 평가 시 EchoMatch 의 24시간 작업 비용 + 알려진 한계 4건 참고

관련: [[feedback-spec-memory-claims-unverified]] (spec 의 'L5 Conquer' / '메모리 명시' 주장 잘못 확인됨)

