> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_polysemy_completion.md
> category: project

---

**v06.225** — 사용자 지시: 사전 **전체** 단어가 실제 쓰이는 모든 POS sense를 갖도록(일반 사전급). 목적: 형태 POS 추론([[project_extraction_coverage_design]] 마이그 `161500`)이 "ransomed→동사 뜻"을 고르려면 각 단어에 그 sense가 실재해야 함. 도서 표본 아닌 **사전 전수** 대상.

**병렬 파이프라인**(재사용):
1. `scripts/dict/sense-chunk.mjs --min-rank A --max-rank B --chunk 160` → 단일-sense content 단어(pos∈noun/verb/adjective, alpha, -ing 제외, `meanings_ko` length===1) 빈도순 → `scripts/dict/sense-chunks/chunk-NN.json`. **chunk-NN.json만 정리하고 .out.json은 안 지움** → wave 전 `rm -f scripts/dict/sense-chunks/*.out.json` 필수.
2. **서브에이전트 병렬**(청크당 general-purpose 1개): chunk-NN.json 읽고, 표준 영어에 실재하는 추가 POS sense/희귀-primary 교정만 **보수적** authoring(애매하면 skip; -tion/-ment/-ity 명사·-ous/-ive 형용사·기술어 대부분 skip). 출력 `chunk-NN.out.json` = `[{word, meanings_ko:[{pos,meaning,v_level}...]}]` (most-common-first). 청크당 ~40분·6-40 changed/160.
3. `node scripts/dict/sense-apply.mjs --commit` → 검증(pos 화이트리스트·v_level 1-11 정수·2+ senses)·일괄 적용: `meanings_ko` + flat `pos`/`meaning_ko`=meanings_ko[0] 동기화 + shared_words. **단일-sense 가드**(이미 다중이면 skip=사람 수정 보호)·멱등. rejected/skipped 로그.

**품질**: 서브에이전트 authoring 정확·보수적(steal→도루·milk→착취하다·desert→탈영하다·boot→부팅·wolf/manifest/march/crisp rare-primary 교정). scripts/dict/sense-chunks/는 gitignore.

**진행**: **Wave 1(rank 1700-6000) 완료** = 수작업 ~100(watch·face·bear·fine·count·surround·fast 등) + 서브에이전트 **388** 적용. 해당 범위 다중-sense 45%(1651/3664). **Wave 2(rank 6000-9000, 13청크) 진행 중**. 잔여: r9000-12000, r12000-20000(단일-sense content 총 ~20,457, 대부분은 정당한 단일-POS라 실 변경은 배치당 15-40개). classified_by 유지(수작업 25개는 원 classified_by; 에이전트분도 원 유지).

**재개**: 다음 range로 `sense-chunk.mjs` → `rm *.out.json` → 13-16 에이전트 dispatch(위 프롬프트) → 완료 대기(`until [ $(ls *.out.json|wc -l) -ge N ]`) → `sense-apply.mjs --commit`.

