-- 20260811140000_extraction_quality_audit.sql
-- 추출 품질 상시 감사 뷰 2종 — "자기개발 루프" 를 1회성 조사가 아니라 계측 자산으로 고정.
--
-- 배경: 전 카탈로그(38권·96,636행) 추출 결과를 버킷별로 처음 감사하면서 결함 2종을 찾았다.
--   ① 반대말 결합 88단어 — en_negation_preserved 불변식으로 차단·수리 완료(20260811130000)
--   ② 문맥 POS 와 사전 POS 불일치 1,403단어 / 9,788회 — 사전 내용 결함(아래)
-- 이런 감사는 한 번 하고 끝나면 다음 도서가 들어올 때 다시 썩는다. 두 뷰로 상시화한다.
--
-- ─────────────────────────────────────────────────────────────
-- v_extraction_quality_audit — 결함 클래스별 현황 (한 줄 = 한 클래스)
-- ─────────────────────────────────────────────────────────────
-- 정의 정정 이력 (원격 `20260811045727_extraction_quality_audit_v2_definitions`, 본 파일은 최종본):
--   · 02 는 표면형=표제어 직접 매칭(bc→bc)까지 결함으로 셌다 → 폴백 오결합만 세도록 좁힘
--   · 04 "미해결" 은 본문에 실재하는 미수록어까지 결함으로 셌다 → 본문에 **없는** 유령만 DEFECT,
--     본문에 있는 미수록어는 INFO(90)로 분리. 후자는 0 이 목표가 아니다(정직한 잔여).
CREATE OR REPLACE VIEW public.v_extraction_quality_audit AS
WITH b AS (SELECT * FROM library_book_vocabularies)
SELECT '01 반대말 결합'::text AS defect,
       'DEFECT — lemma 가 표면형의 부정 의미를 잃음 (imprudent→prudent)'::text AS detail,
       count(*)::int AS rows,
       count(DISTINCT lower(trim(word)))::int AS words,
       COALESCE(sum(frequency_in_book), 0)::bigint AS occurrences
FROM b WHERE lemma IS NOT NULL AND NOT en_negation_preserved(lower(trim(word)), lemma)
UNION ALL
SELECT '02 register 노이즈 오결합',
       'DEFECT — 굴절/파생 폴백이 proper_noun/brand/abbreviation 표제어에 닿음 (dren→dr). 직접 매칭(bc→bc)은 정상이라 제외',
       count(*)::int, count(DISTINCT lower(trim(b.word)))::int, COALESCE(sum(b.frequency_in_book), 0)::bigint
FROM b JOIN shared_dictionary d ON d.word = b.lemma
WHERE d.word_register IN ('proper_noun', 'brand', 'abbreviation')
  AND lower(trim(b.word)) <> b.lemma
UNION ALL
SELECT '03 문맥POS 미대응 sense',
       'DEFECT(사전 내용) — 문맥 POS 와 사전 POS 가 다르고 대응 sense 도 없음. 작업 큐: v_dict_pos_sense_gap',
       count(*)::int, count(DISTINCT lower(trim(b.word)))::int, COALESCE(sum(b.frequency_in_book), 0)::bigint
FROM b JOIN shared_dictionary d ON d.word = b.lemma
WHERE b.context_pos IS NOT NULL AND d.pos IS NOT NULL AND b.context_pos <> d.pos
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(d.meanings_ko, '[]'::jsonb)) s
                  WHERE s->>'pos' = b.context_pos)
UNION ALL
SELECT '04 유령 어휘(본문에 없음)',
       'DEFECT — 본문 어디에도 단어 경계로 없는 미해결 행. purge_ghost_vocab() 으로 제거',
       count(*)::int, count(DISTINCT lower(trim(v.word)))::int, COALESCE(sum(v.frequency_in_book), 0)::bigint
FROM library_book_vocabularies v
WHERE v.lemma IS NULL AND v.noise_kind IS NULL
  AND COALESCE(v.resolved_via, 'not_found') IN ('not_found', 'invalid')
  AND NOT EXISTS (
    SELECT 1 FROM library_chapters_master m JOIN content_chunks c ON c.hash = m.content_hash
    WHERE m.library_book_id = v.library_book_id
      AND c.content ~* ('\m' || regexp_replace(lower(trim(v.word)), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M'))
UNION ALL
SELECT '05 HTML 엔티티 잔존',
       'DEFECT — 본문/근거문장에 &#NNNN; 미디코딩 (ingester decodeEntities 회귀 신호)',
       count(*)::int, count(DISTINCT lower(trim(word)))::int, COALESCE(sum(frequency_in_book), 0)::bigint
FROM b WHERE position('&#' in COALESCE(first_sentence, '')) > 0
UNION ALL
SELECT '90 사전 미수록 잔여(정보)',
       'INFO — 결함 아님. 본문에 실재하나 어떤 사전에도 없는 말(프랑스 은어·그리스/라틴·문화 차용어). dict-selfheal 드레인 대상',
       count(*)::int, count(DISTINCT lower(trim(v.word)))::int, COALESCE(sum(v.frequency_in_book), 0)::bigint
FROM library_book_vocabularies v
WHERE v.lemma IS NULL AND v.noise_kind IS NULL
  AND COALESCE(v.resolved_via, 'not_found') IN ('not_found', 'invalid')
  AND EXISTS (
    SELECT 1 FROM library_chapters_master m JOIN content_chunks c ON c.hash = m.content_hash
    WHERE m.library_book_id = v.library_book_id
      AND c.content ~* ('\m' || regexp_replace(lower(trim(v.word)), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M'));

COMMENT ON VIEW public.v_extraction_quality_audit IS
  '추출 품질 결함 클래스별 상시 현황. 새 도서 유입 후 여기서 0 이 아닌 행이 곧 작업 대상. /admin/quality 계열에서 조회.';

ALTER VIEW public.v_extraction_quality_audit SET (security_invoker = true);

-- ─────────────────────────────────────────────────────────────
-- v_dict_pos_sense_gap — 결함 03 의 **작업 큐**
--   코퍼스 출현 가중 합의로 "사전이 잘못된 품사를 대표로 잡은" 표제어를 추린다.
--   태거(winkNLP) 단발 오류를 피하려 우세 POS 출현 30회 이상만.
--   실측 상위: high→"황홀감, 들뜸; 약물 환각"(172회, 실제는 형용사 '높은')
--             lead→"납; 흑연심"(152) · hide→"가죽"(122) · mean→"비열한"(252)
--             lay→"평신도의"(93) · gun→"엔진을 힘껏 가동하다"(34) · wash→"세탁물"(33)
--   → VCB 사전 보강 큐. 추출/바인딩이 아니라 **사전 내용** 문제라 여기서 고칠 수 없다.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_dict_pos_sense_gap AS
WITH agg AS (
  SELECT v.lemma AS head, v.context_pos AS cp, SUM(v.frequency_in_book)::int AS occ
  FROM library_book_vocabularies v
  WHERE v.lemma IS NOT NULL AND v.context_pos IS NOT NULL
  GROUP BY 1, 2
),
dom AS (
  SELECT DISTINCT ON (head) head, cp AS dominant_pos, occ
  FROM agg ORDER BY head, occ DESC
)
SELECT d.head                AS headword,
       d.dominant_pos        AS corpus_dominant_pos,
       sd.pos                AS dict_pos,
       d.occ                 AS dominant_pos_occurrences,
       sd.meaning_ko         AS current_meaning_ko,
       sd.v_level
FROM dom d
JOIN shared_dictionary sd ON sd.word = d.head
WHERE sd.pos IS NOT NULL
  AND d.dominant_pos <> sd.pos
  AND d.occ >= 30
  AND d.dominant_pos IN ('noun', 'verb', 'adjective', 'adverb')
  AND sd.pos IN ('noun', 'verb', 'adjective', 'adverb')
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(sd.meanings_ko, '[]'::jsonb)) s
                  WHERE s->>'pos' = d.dominant_pos);

COMMENT ON VIEW public.v_dict_pos_sense_gap IS
  'VCB 사전 보강 큐 — 코퍼스 우세 POS(출현 30+)와 사전 대표 POS 가 어긋나고 대응 sense 도 없는 표제어. 학습자에게 다른 품사의 뜻이 노출된다.';

ALTER VIEW public.v_dict_pos_sense_gap SET (security_invoker = true);
