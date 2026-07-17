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

**재개 조건**: kaikki.org 영어 Wiktionary 추출(수 GB JSONL) 확보 → 그때 W2(syn/ant/ipa 대조)·W3(etymology root)·W4(검증) 성립. 없이 가려면 축소범위(curation RPC 확장 + Phase B per-sense v_level + LLM-적합 필드)만. **소스 없는 병렬 충전 금지**(오염 N배).

