-- 20260815082641_ngsl_basic_gaps_set_classified_by.sql
--
-- 앞선 `20260815090000_ngsl_top2000_basic_gaps.sql` 의 결함 보정.
--
-- 무엇이 잘못됐나: 그 마이그레이션의 INSERT 는 `classified_by` 를 채우지 않는다.
--   `resolve_dict_headword(text)` 는 L1(정확 일치)~L5(철자 변이) **모든 경로**에서
--   `d.classified_by IS NOT NULL` 을 요구한다. 따라서 새 표제어 11종은
--   shared_dictionary 에 행으로는 존재하지만 학습자 해석에는 한 번도 잡히지 않았다 —
--   "사전 구멍을 메운다" 는 목적 기준으로 no-op 였다.
--
-- 실측 근거 (적용 직후):
--   · 적용 전 resolve_dict_headword: 12종 중 11종 null (`proven` 만 통과 —
--     이미 classified_by 가 있는 `prove` 의 굴절로 붙었기 때문)
--   · `classified_by IS NULL` 인 행 = 전체 45,301행 중 정확히 이 11종뿐
--   · 적용 후: 12/12 non-null · classified_by IS NULL = 0
--
-- 값 선택: 기존 태그는 분류 주체를 적는다
--   (claude_code_opus_4_7 39,316 · claude_code_derivational 6,351 · _4_8 15 · _opus_5 6).
--   이 11종은 손으로 쓴 뒤 Opus 5 세션에서 확정했으므로 `claude_code_opus_5`.
--
-- 재실행 안전: `classified_by IS NULL` 로 가드되어 두 번 실행해도 기존 태그를 덮지 않는다.

UPDATE shared_dictionary
   SET classified_by = 'claude_code_opus_5',
       updated_at = now()
 WHERE word IN ('something','someone','whatever','throughout','okay','onto',
                'everywhere','hi','fifteen','forty','cannot')
   AND classified_by IS NULL;

-- ── 적용 후 확인 ────────────────────────────────────────────────
-- SELECT t.w, resolve_dict_headword(t.w) FROM (VALUES
--   ('something'),('someone'),('whatever'),('throughout'),('okay'),('onto'),
--   ('everywhere'),('hi'),('fifteen'),('forty'),('cannot'),('proven')
-- ) AS t(w);
-- → 12행 모두 non-null.
