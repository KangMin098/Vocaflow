> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_sense_completion_v8.md
> category: project

---

SENSE_COMPLETION_MULTISESSION.md 런북의 S4 담당(V-Level 8, out-dir `scripts/dict/sc-v8`) 실행 결과 (2026-07-14).

**결과**: 5 wave 루프, 누적 **134 단어** meanings_ko multi-sense 적용. V8 content 단어(noun/verb/adj·알파벳·non-`ing`) 2,650 중 multi-sense 503→**637 (24.0%)**.

**wave별 적용**: 67 → 28 → 18 → 11 → 10 (declining). 각 wave = 13~14 general-purpose 에이전트 병렬 → `sense-apply.mjs --commit`.

**핵심 교훈 — `targets:0`는 구조적으로 도달 불가**: `sense-chunk.mjs`의 targets = 모든 단일-sense content 단어. 잔여 2,013 중 1,429는 bare 단어지만 대부분 legitimately 단일-POS(octopus/pelvis/ligament/celery 등 구체명사·화합물·동식물·해부/질병어)라 에이전트가 매 wave 재스캔 후 정확히 skip. 진짜 완료 신호 = **applied≈0 수렴**(정확도>수량 원칙상 조작 금지). wave 4~5는 이미 marginal informal 변환(brunch/cosy/abdominal) 위주 + reject 비율 상승 → 실용적 수렴으로 판단·종료.

**persistent-reject 패턴**: POS-only 또는 gloss-only 단일-sense 수정(portrayal=adjective→noun, cynic, betrayal, arousal=adjective→noun, incomprehension="이해"→"몰이해" 오데이터)은 이 파이프라인이 2+ senses만 적용하므로 매 wave reject·재출현. 이건 flat-field 교정으로 별도 처리 필요(런북 범위 밖). 특히 **incomprehension gloss가 정반대("이해")** — 데이터 품질 버그.

관련: [[project_dict_context_sense_matching]] (v06.225 sense 인프라).

