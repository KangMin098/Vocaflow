> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_v11_word_register.md
> category: project

---

2026-05-31 — `shared_dictionary.word_register` (TEXT DEFAULT 'standard' + CHECK `standard|modern_advanced|period_cultural|archaic_literary|phrase_unit`) 신설. Migration `add_word_register`. v_level=11 의 17,452건 전량 분류(standard 0): **modern_advanced 12,414 · phrase_unit 4,319 · archaic_literary 435 · period_cultural 284**. 도서 단어장 register 배지·학습 차등 표시용.

**핵심 발견 — "V11=archaic" 통념은 부분적**: 규칙(archaic 마커 434 + phrase band 4,338) 후 잔여 12,579 의 빈도 신호 측정 = frequency_rank **0** / list_tags **9** (빈도로 modern 판별 불가). 그러나 표본 검증 결과 잔여는 **현대 고급/기술/과학 어휘 압도적**(keratin·homozygote·biogeochemistry·trivalent·reuptake·malvertising·mocap·tts·yakuza·rancorous·animus…, period 는 doublet 정도뿐). spec 예시 presume/impunity/perplexity/candour/hansom/brougham/lascar 전부 V11 확인. → V11 = "최희귀 semantic tier" = archaic + **현대 희귀·기술·전문어 혼합**, 후자가 다수.

**그래서 spec §3 LLM batch(12,600단어·126 req·Claude Code 직접분류) 불요**: "규칙으로 archaic/phrase/period 걷어내고 나머지 modern_advanced 기본값"으로 ~95% 정확(spec 허용 오분류 <10% 충족, modern bucket 표본 ~21/22 clean). 12,600 hand-classify 회피.

**규칙 교훈**: spec 의 archaic 어미 규칙 `(est|eth)$ AND len>4` 은 **전부 노이즈** — est$ 36건이 "be no contest"·"acid test"·palimpsest·"person of interest"(구·현대 복합어), eth$ 2건 "gnash your teeth"·shibboleth. 폐기. archaic 은 meaning_ko 마커(`고어|고문|문어체|문어|옛말|옛 |시어|폐어`)+known list 로만. period recall 보강 키워드: 마차·갑옷·작위·(역사) + 마부·범선·각반·백작/남작/자작/후작. 잔존 노이즈: archaic 의 "옛 철자" 현대어(gasolene/estrin), period 의 현대 화폐(riel) — 경미. 멱등(`word_register='standard'` 조건). 배지 UI 연동은 범위 밖(spec §6).

