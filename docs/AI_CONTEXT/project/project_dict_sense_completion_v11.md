> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_sense_completion_v11.md
> category: project

---

`scripts/dict/SENSE_COMPLETION_MULTISESSION.md` 런북의 **S7 = V-Level 11** 담당분 완료 (2026-07-14).

**핵심**: `sense-chunk.mjs --v-level 11` 로 잡히는 단일-sense content word(`^[a-z]+$`, `-ing` 제외)는 **10,052개**. `--chunk 160` → 63청크. 이를 **wave당 14청크씩 5 wave**로 전 63청크를 **1회 전수 examine**. 서브에이전트(general-purpose)가 청크별로 표준 영어 추가 POS/희귀-primary만 보수적으로 authoring → `sense-apply.mjs --dir ... --commit` 로 적용.

- wave1 chunks00-13 → 24 · wave2 14-27 → 22 · wave3 28-41 → 10 · wave4 42-55 → 28 · wave5 56-62 → 47 = **누적 131 단어** multi-sense화.
- V11 content(noun/verb/adj) multi-sense: 약 2,820 → **2,951** (+131).

**중요 — `targets:0` 은 도달 불가(정상)**: sense-chunk의 targets는 "meanings_ko 길이 1" 전부라, 정당하게 단일-POS인 단어(대다수 V11 = 의학/화학/식물/광물 용어·외래어·고유명사·-tion/-ness/-ity 명사·-ous/-ive 형용사)는 영구히 target로 남음. 억지 sense를 만들지 않는 한 0 불가. 전수 examine 후 잔여 **9,921**은 전부 확인된 단일-POS → **재스윕 불필요**(재실행해도 ~0 변경). 이게 이 레벨의 수렴 상태.

**apply 가드 한계**: `sense-apply`는 `meanings_ko.length >= 2`만 적용 → **단일-POS 교정은 reject됨**. 손상 엔트리 `clammy`(형용사인데 명사 "그리스도론"으로 저장)가 wave1에서 reject → 별도 직접 UPDATE로 교정(형용사 "축축하고 차가운, 끈적끈적한"). 유사 손상 단일-sense 교정은 파이프라인으로 안 되니 직접 처리 필요.

**운영 메모**: 각 wave = 14 Agent 병렬 + 백그라운드 Bash wait-loop(`until [ $(ls DIR/*.out.json|wc -l) -ge K ]`)로 완료 감지. 세션 재시작(process exit) 겪어도 disk(chunk 입력)·DB는 온전 → 적용 완료 wave는 멱등 가드로 안전. `sc-*` 는 gitignore(작업파일), DB가 결과물 → 커밋 불요. 관련: [[project_dict_context_sense_matching]] · [[project_dict_field_completeness]].

