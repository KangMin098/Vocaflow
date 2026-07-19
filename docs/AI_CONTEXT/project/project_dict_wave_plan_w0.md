> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_wave_plan_w0.md
> category: project

---

사용자가 dict 대규모 확장 5-Wave 병렬 플랜(구조/충전 이원분류·병렬쓰기+서브에이전트검증·kaikki 증거원) 제시 → W0 read-only 정찰 위임. 문서 = `docs/AI_CONTEXT/diagnostics/dict_w0_20260716.md`.

**W0 피벗 발견**:
- **kaikki 로컬 부재** — 서브에이전트 검증·어원 root·syn/ant 대조채움의 유일 증거원이 없음 → **W3(어원)·W4(gloss검증)·W2-fetch 전부 블록**.
- 플랜 "구조" 객체 전부 그린필드: `word_roots`·`root_links` 테이블 없음, `entry_type`·`etymology`·`word_root` 컬럼 없음, `generate_curated_word_set` RPC 없음.
- W2 파일럿 스크립트(`dict-fetch/update-batch`) 부재(있는 건 [[project_dict_field_completeness]]의 example-fill.mjs·dict-common.mjs·derivational-seed.mjs).

**측정치**: 실사용 shared_words 12,611·vocab 1,822(전체 45k의 ~28%만 노출) · 동음이의 multi-POS 5,170 · CEFR C1+C2 76% 편중(코어 A1–B2 9,566) · 카테고리(domain/track) 매핑 68–85%(자동 단어장 이미 성립) · 3경로 추출 드리프트 이미 0(v06.225 통합) · 형태 파생 base ≥3=116(<200 임계, W3 폐기쪽).

**결정(2026-07-16)**: 사용자 = **여기서 중단**. 추출 신뢰 기반 이미 완결([[project_extract_trust_roadmap]], 뜻·POS 100%, v06.248~252). 병렬 N세션·W1~W5 **미착수**. W2 파일럿도 미실행(소스·스크립트 부재 = 검증불가 자가생성 방지 — 예문만 LLM 적합이라 그 슬라이스만 v06.252로 완료).

**재개 조건**: kaikki.org 영어 Wiktionary 추출(수 GB JSONL) 확보 → 그때 W2(syn/ant/ipa 대조)·W3(etymology root)·W4(검증) 성립.

**✅ kaikki 확보 (2026-07-17, v06.265)**: `kaikki.org-dictionary-English-words.jsonl` **3.19GB**(CC BY-SA 3.0) 다운로드 → `scripts/dict/data/`(gitignore). 파이프라인 `scripts/dict/kaikki-enrich.mjs`(extract=45k 표제어 필터·95.7% 커버 / apply-ipa·syn·ant=결측만·무환각). **IPA PoC 5,879 채움**(64%→76.9%). 후속 buildable: **sense 깊이**(kaikki avg 4.5·≥5 sense 12,131 → 한국어 sense authoring, 근본 갭 해소) · audio mp3 30,902(스키마 필요) · syn/ant는 kaikki 구조화 희소(4,636/3,510)라 저우선(기존 dict-fill 우세).

**✅ sense 깊이 확대(v06.266~267)**: `kaikki-sense-{chunk,apply}.mjs` — kaikki 영어 gloss 근거로 얕은(≤2) 다의어에 한국어 sense 추가(무환각·멱등·가드=추가만). **slice1 freq≤3000 315 + slice2 freq 3k-6k 773 + 3차 freq 6k-31k 6세션병렬 5,406 = 누계 6,494단어**. 퇴화 교정 예: add→더하다·will→모달·bark→짖다·vein→정맥/잎맥/광맥·cookie→컴퓨터쿠키·crow→까마귀·niche→생태적지위. **3+ sense 1,466→5,742행·avg 1.273→1.475**. 노출 다의어 사실상 소진, 잔여=unranked 3,979(tail).
- **멀티 세션 패턴(재사용 가능)**: 1회 스트림→rank정렬 청크→세션별 dir 분할(단어 중복 0 격리)→워커 세션 git commit 금지(CHANGELOG 충돌 차단)→종합 세션 1회 문서/커밋. 워크트리 미사용(코드 변경 0·3.19GB 원본 공유). 지시문 SSoT=`docs/AI_CONTEXT/handoffs/ksense_multisession_20260717.md`.
- **정확도 구멍(주의)**: apply 가드=`개수 증가`만 강제 → 품질 회귀(sense 드롭·inflation) 원리상 못 잡음. 검증 패스 없음(신뢰 기반). 읽기전용 감사 `scripts/dict/_ksense_{check,redundancy,preserve}.mjs`로 사후 측정: 드롭 표본상 0·inflation 0.8~2.7%. 대규모 재실행 시 소프트 보존 플래그 권장.
- ksense-* dir gitignore(`scripts/dict/ksense-*/`). 어원 root(W3)는 별도로 표준 어근 시드로 이미 구축([[project_etymology_root_axis]]). 분석 = `docs/AI_CONTEXT/diagnostics/extraction_dict_vs_general_20260717.md` §7.

