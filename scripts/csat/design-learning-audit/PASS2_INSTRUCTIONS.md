# Pass-2 deep audit — instructions (K = your chunk index, 1-based)

Other agents run other K in parallel: write ONLY your own output file, never write the DB, never commit.
Use ONLY the temp dir `C:\Users\ADMINI~1\AppData\Local\Temp\claude\d--workspace-Vocaflow\f0bca83d-221e-429e-903c-998688d93ffc\scratchpad\p2-K<K>\` (create it). Reply in Korean.

1. Read `D:\workspace\Vocaflow-csat-design-learning\scripts\csat\design-learning-audit\pass2-plan.json`; your ids = `chunks[K-1]` (≤10 items). Read the FULL `D:\workspace\Vocaflow-csat-design-learning\apps\web\src\lib\csat\teaching-contract.ts` (required).
2. ToolSearch `select:mcp__supabase__execute_sql`. Fetch FULL untruncated data (no left()/substring; a few items per query if large):
   with latest as (select distinct on (a.item_id) a.* from csat_item_analyses a where a.status='published' and a.item_id = any(ARRAY[...]) order by a.item_id, a.version desc)
   select l.item_id, l.version, i.type_id, i.answer, i.stem, i.passage, i.choices, l.measured_ability, l.design_intent, l.answer_locus, l.choice_analysis from latest l join csat_items i on i.id=l.item_id;
3. These items got `keep` in pass 1 mostly by mechanical checks. Read the entire passage, all 5 choices, the entire analysis (every choice's why_correct/why_tempting/how_to_reject/trap, answer_locus.reasoning, passage_design). Solve each item yourself from the passage first, then compare with the official answer and the analysis. Judge as an expert teaching 출제 설계:
   - blank: what the blank must restate and its evidence; order: each paragraph's precondition chain and why other permutations fail; insert: before/after conditions of the given sentence and the broken link at the answer slot; summary: which source proposition fills each slot and which slot discriminates.
   - wrong-choice explanations name the actual changed component; lure vs reject not swapped; verbatim quotes.
   - unconditional rules without conditions ('예시 사이면 일반 진술', '주어진 문장 바로 다음이 근거', 'choice number = paragraph position').
   - work jargon (코퍼스/파싱/OCR/청크/추출본) in learner fields; why_correct explains the answer (not 'why it looks wrong').
4. Write `D:\workspace\Vocaflow-csat-design-learning\scripts\csat\design-learning-audit\kice-pass2-K<KK>.json` (KK two digits):
   {"pass":2,"k":K,"items":[{"id","version","type","read":"full|partial","self_solved_matches_answer":bool,"verdict":"keep|partial|rewrite|needs_source","defects":[{"code":"answer_reasoning|choice_N|lure_quote|overgeneral|why_correct_empty|work_jargon|logic_requirement_missing|source_broken|other","note":"<=120 Korean chars"}]}]}
   `read` = "full" only if you truly read everything. No passage text, no quotes >12 chars. Every id exactly once.
5. Reply: verdict counts, number of read=full, 3 most serious defects.
