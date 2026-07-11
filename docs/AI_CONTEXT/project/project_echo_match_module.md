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

**🔴 런타임 점검 (2026-07-07, Playwright 가짜마이크 실주행)**: 파이프라인은 E2E 완주(로그인→마이크→Piper 로드 ~17s→4-Phase→DB 적재, 콘솔 에러 0). **그러나 채점 3축 전부 구조 결함 — 실사용(개발자 육성) 7건 overall 0~53, timing 6/7건 0점**. 원인(dtw-comparator.ts): ① pitch = 절대 Hz DTW, 화자 기저피치 정규화 없음 → Piper Amy(여성 ~200Hz) vs 남성 화자(~110Hz) 평균차만으로 threshold 80Hz 소진 = 구조적 0점 ② energy = 절대 RMS DTW(threshold 0.08), 마이크 게인 정규화 없음 ③ timing = 수동 정지 duration 비율, 무음 트리밍 없음 → 발화 전 지연+버튼 찾는 시간 포함, 8.5s 녹음/3s 참조 = 0점. **✅ 수리 완료 (v06.158 `03eee59`)**: ① semitone+화자 평균 제거 곡선 DTW(threshold 5st) ② 피크 정규화 상대 에너지(0.4) ③ voiced 발화 길이 로그 비율(2.5배=0점). 회귀 테스트 7종이 결함 모드 3건 고정(`__tests__/dtw-comparator.test.ts`). 잔여: threshold 실음성 재보정 · 런타임 재주행(멀티 세션 dev 서버 `.next` 공유 충돌로 유닛 검증까지만 — 파이프라인 완주는 수리 전 실주행에서 확인) · 육성 재검증 권장. 테스트 자산: runtime-test 계정 텍스트 `89970bfa-f49d-44c2-92ce-75895a608317` (5문장) 존치. ⚠️ 교훈: 두 세션이 dev 서버를 같은 `.next`로 띄우면 라우트 404 오염 — 내 서버 재기동 반복 금지.

**🟡 기능·효과 평가 (2026-07-10, 전 코드 검토)**: **작동함** — 파이프라인 완결 + v06.158 재설계로 구조적 0점 3결함 해소(회귀 7종). **효과 한계 3건**: ① 프로소디(억양·강세·리듬)만 측정 **발음/단어 정확도 미검증** — 틀린 단어라도 멜로디 맞으면 고득점(최대 검증 갭) ② 참조가 합성 TTS(원어민 아님) ③ 임계값 **실음성 미보정**(회귀 전부 합성 contour). **반영(v06.190)**: #3 `divergenceRegions`(억양 ≥3st 벌어진 구간 PitchVisualizer 음영 지목, 회귀 4종) + #4 문구 정직화("원어민에 가까워요"→"억양·리듬이 잘 맞았어요"). **#2 단어 정확도 게이트(구현, v06.190)**: EchoMatchPlayer가 녹음과 병렬로 `createRecognizer`(lib/workspace/speech-recognition) 실행 → `computeShadowMatch`로 인식률 산출; <40%면 프로소디 celebrate 대신 "단어부터 또박또박" 게이트. **완전 additive·전면 guard** — 미지원/실패/무음은 wordRatio=null(프로소디-only 폴백), 녹음·채점 무영향. ⚠️ 실 육성 인식 정확도는 헤드리스 검증 불가(Chrome 실기 필요), 구조·guard만 검증. **자동 실주행(v06.190, `06-echomatch-fakemic.spec.ts`)**: Chrome 합성 오디오 fake-mic 로 전체 4-Phase 자동 완주 검증 — `overall=48`(pitch23·energy55·timing74), 크래시·콘솔에러 0, 구조적 0점 없음(비발화 톤에 거짓 고득점 X=변별력). `overall>0` 회귀 가드. 메모리의 '육성 재주행 잔여'를 **자동화로 대체**(합성 톤이라 사람 보정 아님). **잔여(사용자 결정)**: #1 실음성 threshold 보정 — 실제 육성 샘플 필수(합성 톤 점수는 캡처 타이밍에 따라 48~76 변동 = 보정 소스 못 됨). **#1 실행 다리 마련됨**: `06-echomatch-fakemic.spec.ts` 에 `ECHO_FAKE_WAV=<abs .wav>` 주입 경로(=`--use-file-for-fake-audio-capture`) — 사람 육성 wav 를 넣으면 자동으로 채점 경로를 태워 실측 점수 획득(파일 루프라 녹음창 6s로 발화 포함). 육성 wav 확보 시 이 경로로 보정 데이터 수집.

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

