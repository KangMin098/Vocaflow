-- supabase/migrations/20260813110729_word_set_rls_inherit_source_gate.sql
-- (파일명 = 실제 적용 버전 supabase_migrations.schema_migrations.version)
--
-- 발행 세트 RLS 가 "원본이 발행됐는가" 를 함께 본다 — 노출 게이트를 데이터 계층에서 강제.
--
-- 무엇이 잘못됐나 (2026-08-13 실측):
--   `shared_word_sets` 의 SELECT 정책은 `is_published = true` 하나뿐이었다. 반면 학습자 화면은
--   `lib/library/publish-gate.ts` 로 "원본 도서/글이 발행됐는가" 까지 본다. 게이트가 앱 코드에만
--   있어서, **UI 로는 안 보이는데 공개 API 로는 읽히는** 세트가 생겼다.
--
--   anon 키 직접 조회 실측: 미발행 도서의 발행 세트 516개 + 그 단어들이 전부 반환됐다
--   (같은 키로 `library_books` 행 자체는 0 — 책은 막히는데 그 책의 단어장은 열려 있었다).
--   `subscribeSet`(vocab/actions.ts) 도 `is_published` 만 검사하므로 set id 만 알면 구독됐다.
--
--   범위: `library_book` 발행 세트 993개 중 **587개(20,907단어 · 도서 27권)** 가 미발행 도서 소속.
--
-- 왜 생겼나: ADR 0004 D1/D2 적용을 "학습자 노출이 없는 ready 도서부터" 단계 적용했다.
--   그 전제는 UI 기준으로 참이었고 API 기준으로 거짓이었다. 판단이 아니라 전제가 불완전했다.
--
-- 이 마이그레이션의 효과 (적용 전 실측):
--   · 계속 보이는 세트  : 도서 406 + 아티클 135 + 기타 카테고리 176
--   · 가려지는 세트     : 587 (전부 미발행 도서 소속)
--   · 기존 구독 영향    : 0 — 미발행 도서 세트 구독 71건은 전부 admin(강민) 계정이고,
--                        admin 은 `admin_curator_all_*` 정책으로 계속 전부 읽는다.
--
-- 기준선: `applyBookReadGate`(status='published') + 도서 RLS 의 copyright_safe_in_kr.
--   카탈로그 게이트의 `published_at IS NOT NULL` 까지는 요구하지 않는다 — publish-gate.ts 가
--   "카탈로그 ≠ 열람" 을 의도적으로 분리해 뒀고(과거 도서 404 방지), 세트는 열람 쪽에 가깝다.
--
-- ⚠️ 두 정책의 조건은 같아야 한다. 한쪽만 고치면 세트는 가려지는데 단어는 읽히는(또는 반대)
--    상태가 된다. 회귀 테스트: apps/web/src/lib/library/__tests__/word-set-rls.integration.test.ts

-- ── 세트 ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "read published" ON public.shared_word_sets;

CREATE POLICY "read published" ON public.shared_word_sets
FOR SELECT
USING (
  is_published
  AND (
    -- 소스 종속이 아닌 세트(csat · themed · etymology …)는 종전대로 is_published 만 본다.
    category NOT IN ('library_book', 'library_article')
    OR (
      category = 'library_book'
      AND EXISTS (
        SELECT 1 FROM public.library_books b
        WHERE b.id::text = shared_word_sets.curation_query->>'book_id'
          AND b.status = 'published'
          AND b.copyright_safe_in_kr
      )
    )
    OR (
      category = 'library_article'
      AND EXISTS (
        SELECT 1 FROM public.library_articles a
        WHERE a.id::text = shared_word_sets.curation_query->>'article_id'
          AND a.status = 'published'
          AND a.copyright_safe_in_kr
      )
    )
  )
);

-- ── 단어 ──────────────────────────────────────────────────────────
-- 세트 정책의 조건을 그대로 반복한다. `EXISTS (SELECT 1 FROM shared_word_sets ...)` 만 두고
-- 상위 정책에 위임하는 편이 짧지만, 정책 표현식 안의 서브쿼리에 RLS 가 적용되는지는
-- 버전·소유자 설정에 따라 달라질 수 있는 미묘한 의미론이다. 보안 경계는 명시적으로 적는다.
DROP POLICY IF EXISTS "read words of published" ON public.shared_words;

CREATE POLICY "read words of published" ON public.shared_words
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.shared_word_sets s
    WHERE s.id = shared_words.set_id
      AND s.is_published
      AND (
        s.category NOT IN ('library_book', 'library_article')
        OR (
          s.category = 'library_book'
          AND EXISTS (
            SELECT 1 FROM public.library_books b
            WHERE b.id::text = s.curation_query->>'book_id'
              AND b.status = 'published'
              AND b.copyright_safe_in_kr
          )
        )
        OR (
          s.category = 'library_article'
          AND EXISTS (
            SELECT 1 FROM public.library_articles a
            WHERE a.id::text = s.curation_query->>'article_id'
              AND a.status = 'published'
              AND a.copyright_safe_in_kr
          )
        )
      )
  )
);
