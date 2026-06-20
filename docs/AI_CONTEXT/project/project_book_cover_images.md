> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_book_cover_images.md
> category: project

---

2026-06-06 — 도서 원천 표지 이미지 시스템 (A안: 상세 sheet 한정, 그리드는 그라디언트 유지).

- **스키마**: `library_books.cover_image_url TEXT` (migration `add_library_books_cover_image_url`). null = 그라디언트 fallback.
- **해결기**: `lib/library/cover-image.ts` `resolveCoverImageUrl({source, sourceId})` (server-only) — Gutenberg `pg{id}.cover.medium.jpg`(HEAD 200 확인) · Standard Ebooks ebook 페이지 `og:image` 파싱(= `/downloads/cover.jpg`, 제목 타이포 박힘) · 그 외 null.
- **서빙**: `next/image` + `next.config.mjs` remotePatterns(`www.gutenberg.org`, `standardebooks.org`). **next.config 변경이라 dev 서버 재시작 필요**.
- **렌더**: (A) `NetflixDetailSheet` Hero 실 표지(블러 backdrop object-cover + 중앙 contained object-contain + scrim, landscape라 contain). (B, 적용됨) `LibraryGrid` CarouselBook + `MyLibraryCarousel` CoverShell 카드도 실 표지(3:4 portrait 카드라 object-cover, letterbox 없음). **uniform 규칙**: 실 표지 있으면 큰 제목 오버레이 숨김(대부분 표지에 제목 박힘 — SE/Gutenberg 중복 회피), CEFR/V·학습상태·진행바 칩만 유지 + 캐러셀 하단 Hero info 가 제목 제공. 없으면 그라디언트(`book-cover.ts`).
- **수집 자동화**: `process`/`dev-process` 가 (재)처리 시 자동 해결·저장 (best-effort). 기존 도서 일괄 = `POST /api/admin/library/backfill-covers`(admin).
- **현황**: 게시 3권(Gutenberg 1342/1259, SE gibbon) backfill 완료.

**설계 결정**: 그리드 전면 이미지화는 Gutenberg 품질·비율 편차로 일관성 붕괴 위험 → 상세(결정 순간)에만. SE 표지는 제목 박혀있어 오버레이 주의. Phase 2 = Supabase Storage 다운로드 캐싱(CC0/PD 호스팅 합법). 관련: [[project_copyright_gate_us_license]].

