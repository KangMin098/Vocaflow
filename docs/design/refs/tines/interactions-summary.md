# 참조 사이트 — 팝업 · 상호작용 기록

> 생성 `scripts/design/extract-interactions.mjs` · 2026-09-21 · 손으로 고치지 말 것. 구조·수치만 — 스크린샷은 `tmp/tines-capture/interactions/`(커밋 안 함).

| 시나리오 | 무엇을 했나 | 열린 층 | 크기 | 역할 · 모달 | 포커스 · 입력 | Esc 닫힘 | 배경막 | 모션 | 컴포넌트 | 제목·라벨 |
|---|---|---|---|---|---|---|---|---|---|---|
| cookie-customize | 쿠키 배너 → 설정 | `div` | 1212×108 @114,772 | — | 4 · 4 | ✗ | ○ | — |  | Necessary (25) / Preferences (11) / Analytics (26) / Marketing (36) |
| mega-product | 헤더 Product 메뉴 | `div` | 1440×310 @0,68 | — | 4 · 0 | ✗ | — | snappyIn | SiteNav26 · FlowerField |  |
| search-typed | 검색 → "slack" 입력 | `div` | 1440×900 @0,0 | dialog · modal | 2 · 1 | ✗ | — | snappyIn | GlobalSearch |  |
| usecase-tab-2 | 홈 팀 탭 두 번째로 전환 | `div` | 1360×939 @40,398 | — | 11 · 0 | ✗ | — | useCasesReveal, panelWipe, frameFloatIn | HomeUseCasesSection | IT / Security / Finance / People |
| faq-open | 3B FAQ 첫 질문 펼치기 | `div` | 1440×68 @0,0 | — | 0 · 0 | ✗ | — | opacity | SiteNav26 |  |
| video-play | 3B 영상 재생 단추 | `div` | 1344×755 @48,558 | — | 0 · 0 | ✗ | — | veilDip | VideoPlayer |  |
| contact-form | 문의 폼(열린 상태 그대로) | `form` | 552×539 @156,1862 | — | 8 · 5 | — | — | — | ContactSupportForm · TextInput · Textarea · FileAttachmentSection · ConsentCheckboxes | Attach a file (optional) / I have read and agree to Tines’ privacy  |
| events-filter | 이벤트 필터 하나 켜기 | 층 없음 | | | | | | | | |
| mobile-menu | 390 햄버거 | `div` | 374×329 @8,67 | — | 7 · 0 | ✗ | — | snappyDown | SiteNav26 |  |
| mobile-submenu | 390 햄버거 → Product 하위 | `div` | 374×769 @8,67 | — | 11 · 0 | ✗ | — | snappyDown, snappyIn | SiteNav26 · FlowerField |  |
| not-found | 404 화면 | `div` | 1440×1762 @0,0 | — | 94 · 1 | — | — | snappyIn-hef1dx9 |  | Page not found |
