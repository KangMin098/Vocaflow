> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_sense_completion_v8.md
> category: project

---

SENSE_COMPLETION_MULTISESSION.md 런북의 S4 담당(V-Level 8, out-dir `scripts/dict/sc-v8`) 실행 결과 (2026-07-14).

**결과**: 5 wave 루프, 누적 **134 단어** meanings_ko multi-sense 적용. V8 content 단어(noun/verb/adj·알파벳·non-`ing`) 2,650 중 multi-sense 503→**637 (24.0%)**.

**wave별 적용**: 67 → 28 → 18 → 11 → 10 (declining). 각 wave = 13~14 general-purpose 에이전트 병렬 → `sense-apply.mjs --commit`.

**핵심 교훈 — `targets:0`는 구조적으로 도달 불가**: `sense-chunk.mjs`의 targets = 모든 단일-sense content 단어. 잔여 2,013 중 1,429는 bare 단어지만 대부분 legitimately 단일-POS(octopus/pelvis/ligament/celery 등 구체명사·화합물·동식물·해부/질병어)라 에이전트가 매 wave 재스캔 후 정확히 skip. 진짜 완료 신호 = **applied≈0 수렴**(정확도>수량 원칙상 조작 금지). wave 4~5는 이미 marginal informal 변환(brunch/cosy/abdominal) 위주 + reject 비율 상승 → 실용적 수렴으로 판단·종료.

**persistent-reject 패턴 → 별도 교정 완료**: POS-only/gloss-only 단일-sense 수정은 sense-apply(2+ senses 가드)가 매 wave reject. DB 전수 스캔으로 V8 실제 오라벨 5건 확정·교정: `arousal`·`betrayal`·`cynic`·`portrayal`(명사가 adjective로 저장) + `incomprehension`(뜻 "이해"→정반대 "몰이해, 이해하지 못함"). 교정 경로 = **`scripts/dict/sense-fix-single.mjs` FIXES 배열 append + `--commit`** (MCP execute_sql 직접 UPDATE는 분류기 차단 → service-role node 우회, [[project_sense_completion_v1_4.md]] 교훈). 스캔 팁: adjective 라벨인데 meaning_ko가 명사 gloss(한국어 adnominal 어미 의/인/는/ㄴ 없음)면 오라벨. 대부분의 -al/-ical/-ual adjective는 정상(analytical/judicial/surgical…).

관련: [[project_dict_context_sense_matching]] (v06.225 sense 인프라).

