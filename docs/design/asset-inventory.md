# 이미지 자산 인벤토리 (Gate 0b)

> 2026-09-19 · 작성 Claude Code · 지시: [image-system-brief](image-system-brief.md) Gate 0(b).
> 범위: `apps/web/public` · `packages/ui-shared` · `apps/web/src/**/*.{svg,png,jpg,webp,ico}` · 인라인 `<svg>` 컴포넌트 · 표지 생성 코드 · OG · 파비콘 · 웹 앱 아이콘.
> **`apps/mobile` 은 범위 밖**(2026-09-19 사용자 지시 「모바일은 제외」 — Expo 앱, Phase 2). 웹의 390px 뷰포트는 범위 안이다(AGENTS.md 모바일 퍼스트).
> 방법: `find` · `grep -rl '<svg'` · `git ls-files` · `git check-ignore`(작업 트리 기준, 미커밋 파일 포함). **판정 칸의 "재생성"은 Gate 4 manifest 후보라는 뜻이지 확정이 아니다** — 확정은 사람이 방향(Gate 3)을 고른 뒤.
> "별도 정본" = 이 작업이 손대지 않는 자산(아케이드 · 표지 생성 코드). **사람 확인** 칸에 ✋ 표시.

## 0. 요약

| 분류 | 수 | 판정 |
|---|---|---|
| 사람이 보는 **삽화 파일** | **0** | `public/` 에 삽화·아이콘 이미지가 하나도 없다(03-system §3-5 「자산 파일 0개로 서명」 결정의 결과) |
| **참조는 있는데 파일이 없는 것** | **3**(웹) + 모바일 3(범위 밖) | 🔴 §1 — Gate 4 manifest 1순위 |
| 코드가 그리는 이미지(OG · 표지 · 데이터 형태) | 20 | 유지 또는 무대 규칙만 적용 |
| 삽화 대체 후보(빈 상태 · 모듈 머리의 lucide 얼굴) | 5 컴포넌트 | 재생성 후보 |
| 아케이드 · 3D · 오디오 | 62 glb · 24 오디오 · `components/game` SVG 18 | 별도 정본 ✋ |
| 개발 스크린샷 | 22 png | 대상 아님(gitignore, 추적 0) |

## 1. 🔴 참조 깨짐 — 파일이 없다

| 참조하는 곳 | 가리키는 경로 | 실제 | 규격 | 판정 · 이유 |
|---|---|---|---|---|
| `apps/web/src/app/layout.tsx:113` `icons.apple` | `/apple-touch-icon.png` | **없음** | 180×180 | 재생성 — iOS 홈 화면 추가 시 404 |
| `apps/web/public/manifest.json` `icons[0]` | `/icons/icon-192.png` | **없음**(`public/icons/` 폴더 자체가 없다) | 192×192 | 재생성 — PWA 설치 아이콘 404 |
| `apps/web/public/manifest.json` `icons[1]` | `/icons/icon-512.png` | **없음** | 512×512 | 재생성 — 같은 이유 |
| `apps/mobile/app.json` `icon` · `splash.image` · `adaptiveIcon.foregroundImage` | `./assets/*.png` 3개 | **없음**(`apps/mobile/assets/` 없음) | — | **범위 밖**(모바일 제외 지시) — 기록만. 빌드 전에는 드러나지 않는다 |

함께 낡은 값: `manifest.json` 의 `theme_color #3B82F6`(Tailwind 파랑 — DD-10 이 폐기한 값) · `background_color #FFFFFF`(순백 — SKILL §2 표 "순백 금지"). 아이콘을 만들 때 `--p`/`--bg` 로 함께 고친다(A5 — 화면 코드가 아니지만 Gate 6 에 묶는다).

## 2. 코드가 그리는 이미지

| 경로 | 규격 | 쓰이는 화면 | 판정 | 이유 |
|---|---|---|---|---|
| `apps/web/src/app/favicon.ico` | 16 · 32 · 48 · 256 (4장) · 25,931 B · 2026-04-28 커밋 | 전 화면 탭 | 재생성 후보 ✋ | 브랜드 마크가 v07 에서 「주묵 각인 + Lora 워드마크 + 권점」으로 바뀌었는데(`04-application.md` §4-3) 파비콘은 그 전 커밋이다. 내용 일치 여부는 이번에 열어 보지 않았다 |
| `apps/web/src/lib/seo/og-card.tsx` (`OG_SIZE` 1200×630) | 1200×630 PNG(런타임 `ImageResponse`) | 아래 4개 라우트 공용 | 유지 · 무대 규칙 적용 후보 | 공유 카드 단일 출처. 삽화가 아니라 표지·제목 조판 — 옵션 ②면 격자 무대만 입힌다 |
| `app/(main)/library/books/[bookId]/opengraph-image.tsx` | 1200×630 | `/library/books/[bookId]` | 유지 | `og-card` 사용 |
| `app/(main)/library/scripts/[bookId]/opengraph-image.tsx` | 1200×630 | `/library/scripts/[bookId]` | 유지 | 같음 |
| `app/(main)/comics/adapted/[bookId]/opengraph-image.tsx` | 1200×630 | `/comics/adapted/[bookId]` | 유지 | 같음 |
| `app/(main)/comics/restored/[slug]/opengraph-image.tsx` | 1200×630 | `/comics/restored/[slug]` | 유지 | 같음 |
| `app/(marketing)/fit/s/[payload]/opengraph-image.tsx` | 1200×630 | `/fit/s/[payload]` 공유 | 유지 | 골든 1호(`/fit`)의 공유면 — 골든과 함께 움직인다 |
| (없음) 루트 기본 OG 이미지 | — | `/` · 그 밖 공개 화면 | **신규 후보** | `layout.tsx` `openGraph` 에 `images` 가 없다 — 랜딩 공유 시 텍스트만 |
| `packages/library-pipeline/src/textbook/cover.ts` | SVG, 목록 폭 112px(`COVER_LIST_WIDTH`) · 유동 | 교재 매대·상세 | **별도 정본** ✋ | 표지 정본은 코드(SKILL §1 라우팅 「표지·브랜드 보드 이미지 — 스킬 없음」 · DD-05 `brandkit` 이동 이유) |
| `packages/library-pipeline/src/vocab/cover-art.ts` | SVG `viewBox` 시드 결정론 | 단어장 표지 | **별도 정본** ✋ | 같음 |
| `apps/web/src/lib/library/cover-image.ts` | 외부 URL(Standard Ebooks og:image 등) | 도서 표지 | 대상 아님 | 외부 원천 표지 해석기 — 우리 자산이 아니다 |
| `components/library/MediaCover.tsx` · `library/vocab/VocabCoverArt.tsx` | 인라인 SVG | 매대 | 별도 정본 ✋ | 표지 렌더러 |
| `components/comic/StyleSwatch.tsx` | 인라인 SVG | 만화 | 별도 정본 ✋ | 만화 표지 장르색은 아트워크 예외(03-system §3-2 변경 금지) |

## 3. 데이터가 그리는 형태 — 삽화가 아니다(유지)

형태 문법(DESIGN_SYSTEM §✒ F1–F5)과 G1 축의 몸이다. 삽화 체계가 이것을 대체하면 N4 가 무너진다.

| 경로 | 무엇 | 판정 |
|---|---|---|
| `components/layout/MemorySparkline.tsx` | R(t) 7일 감쇠 선 | 유지 |
| `components/dashboard/ActivityTrace.tsx` | 활동 궤적 | 유지 |
| `components/csat/session/QuestionArchitecture.tsx` | 문항 구조 도해(주묵 문법) | 유지 |
| `components/worksheet/PrintSheet.tsx` | 인쇄 판면 | 유지 |
| `components/ui/ios/ActivityRing.tsx` | 링 게이지 | 유지(평균 신호 여부는 별도 감사 — `/wordvault` 감사 판정 평균의 원인 중 하나, DESIGN.md 표) |
| `components/workspace/FloatingAudioPlayer.tsx` · `spellforge/MeaningDisplay.tsx` | UI 기호 | 유지 |
| `components/ui/press/*`(`SealMark` · `Gwonjeom` · `JuMark` · `DecayUnderline` …) | 서명 어휘 | 유지 — 삽화 팔레트의 액센트 한 점은 이 어휘(권점·낙관)와 같은 `--ju` 를 쓴다 |
| lucide-react (import 파일 359) | 아이콘 | 유지 — 03-system §3-5 규칙(12~20px · stroke 2 · 둥근 컨테이너 금지). 삽화가 아이콘을 대체하지 않는다 |

## 4. 삽화 대체 후보 — 지금은 아이콘이 얼굴이다

| 경로 | 지금 얼굴 | 쓰이는 곳 | 판정 | 이유 |
|---|---|---|---|---|
| `components/ui/EmptyState.tsx` | `icon` prop — 주석이 "Lucide icon 권장 size 48~64" | 5곳(`TextHubContent` · `DictationSetupClient` · `ResourcePortfolio` · admin `SourceCatalogTab` · `/dev/components`) | 재생성 1순위 | 빈 상태에 48~64px 아이콘 = 개념 설명 0. 렌즈 4(빈 상태 = 전시장) · Uxcel U7(결과물 미리보기) 방향으로 |
| `components/textviewer/EmptyState.tsx` | lucide `FileText` · `Library` | `/text` 허브 첫 방문 | 재생성 후보 | 같음 |
| `components/wordvault/hub/WordVaultEmptyState.tsx` | lucide `FileText` · `Library` | `/wordvault` 빈 상태 | 재생성 후보 | 같음 |
| `components/library/shared/ShelfEmptyState.tsx` | lucide `AlertTriangle` · `RotateCcw` 18px | 서가 빈 상태 4곳 | 재생성 후보(오류 톤은 아이콘 유지) | 빈 서가 톤만 삽화 대상. 조회 실패는 아이콘이 맞다 |
| `components/hub/ModuleHero.tsx` | `LucideIcon` prop | 모듈 허브 8화면 | 재생성 후보 ✋ | v06.30 에 장식 6층을 걷어낸 이력(파일 머리 주석) — 삽화를 다시 얹는 것이 그 결정과 부딪히는지 사람 확인 |

## 5. 별도 정본 · 대상 아님

| 경로 | 수 · 규격 | 판정 |
|---|---|---|
| `components/game/**` 인라인 SVG | 18 파일 | 별도 정본 ✋ — 아케이드는 모션·색 예외 구역(AGENTS.md) |
| `app/(main)/arcade/page.tsx` 인라인 SVG | 1 | 별도 정본 ✋ |
| `components/pairflip/PairFlipMascot.tsx`(부엉이 캐릭터, 4상태, 기본 100px) · `PairFlipCard` · `PairFlipEnv` · `PairFlipScoreRing` | 4 | 별도 정본 ✋ — PairFlip 모듈 팔레트 예외(03-system §3-2). 단 **캐릭터**는 A4(캐릭터·얼굴 금지)와 부딪힌다 — 유지할지 사람 확인 |
| `apps/web/public/pirate/*.glb` | 62 | 별도 정본 — 아케이드 3D |
| `apps/web/public/audio/**` | mp3 19 · wav 5 · ogg 1 | 대상 아님(이미지 아님) |
| `apps/web/public/onnx/*` | 8 | 대상 아님 |
| `apps/web/public/dev/csat-shots/*.png` | 22 | 대상 아님 — `.gitignore:222` 로 무시, 추적 0 |
| `app/admin/**` 인라인 SVG | 9 파일 | 대상 아님 — Admin 은 삽화 체계 밖(04-application §4-4 층위 C). 도움말 동기화 규칙은 Admin 자산을 바꿀 때만 |
| `packages/ui-shared` | 이미지 0 | — |
| `docs/design/golden/*.png` · `docs/design/shots/**` | 문서 증거 | 제품 자산 아님 |
