# PC 학습/공개 Tines 잔여 소스 목록

자동 소스 후보이며 AI 미감/정상 화면 판정이 아니다. 관리자·CSAT는 3B, 개발 화면과 모바일 전용 구성은 제외한다. 페이지·조상 layout·공통 UI/팝업까지 연결해 고정 폭·사각 패널·자체 팝업·지역 팔레트를 조사했다. 같은 공통 컴포넌트가 여러 라우트에 연결되면 각 행에 나타난다. 후보 수는 미완료 판정이 아니며 현재 상태는 실제 검증 범위를 따로 기록한다. `scripts/design/remaining-learning-audit.mjs` 재실행으로 갱신한다.

| 라우트 | 소스 후보 수 | 현재 검증 범위 | 후보 대표 소스 |
|---|---:|---|---|
| / | 16 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/page.tsx:78 |
| /about | 17 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(marketing)/about/page.tsx:91 |
| /arcade | 22 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/arcade/page.tsx:702 |
| /arcade/ranking | 9 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/layout.tsx:45 |
| /comics | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/comics/layout.tsx:11 |
| /comics/adapted | 20 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/ui/ios/InsetRow.tsx:52 |
| /comics/adapted/[bookId] | 18 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/comics/adapted/[bookId]/page.tsx:206 |
| /comics/restored | 30 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/comics/restored/page.tsx:104 |
| /comics/restored/[slug] | 16 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/comics/restored/[slug]/page.tsx:196 |
| /dashboard | 22 | 정상 PC 렌더 + 격리 기능 검증 | apps/web/src/app/(main)/dashboard/page.tsx:77 |
| /diagnostic | 54 | 격리 PC 상태 검증 | apps/web/src/components/ui/ios/InsetRow.tsx:52 |
| /diagnostic/history | 17 | 격리 PC 상태 검증 | apps/web/src/components/ui/ios/InsetRow.tsx:52 |
| /dictate | 35 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/ui/ios/InsetRow.tsx:52 |
| /dictate/results | 27 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/dictate/results/page.tsx:13 |
| /dictate/session | 41 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/dictate/session/page.tsx:13 |
| /dictate/setup | 30 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/dictate/setup/page.tsx:14 |
| /fit | 32 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(marketing)/fit/page.tsx:201 |
| /fit/s/[payload] | 28 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(marketing)/fit/s/[payload]/page.tsx:62 |
| /flashcard | 18 | 공통 머리 적용 / 본문 잔여 | apps/web/src/components/hub/TodayQueue.tsx:75 |
| /flashcard/play | 33 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/flashcard/play/page.tsx:108 |
| /hub | 28 | 이전 회차 적용 검증 | apps/web/src/app/(main)/hub/page.tsx:71 |
| /hub-lab | 31 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/ui/ios/InsetRow.tsx:52 |
| /join/[code] | 12 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(marketing)/join/[code]/page.tsx:77 |
| /library | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/library/layout.tsx:14 |
| /library/books | 70 | 정상 PC 렌더 + 격리 기능 검증 | apps/web/src/components/ui/ios/InsetRow.tsx:52 |
| /library/books/[bookId] | 38 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/library/books/BookDetailClient.tsx:105 |
| /library/scripts | 37 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/ui/ios/InsetRow.tsx:52 |
| /library/scripts/[bookId] | 11 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/library/scripts/[bookId]/page.tsx:388 |
| /library/textbooks | 35 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/library/textbooks/ShelfScreen.tsx:81 |
| /library/textbooks/[series] | 35 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/library/textbooks/ShelfScreen.tsx:81 |
| /library/textbooks/[series]/[step] | 52 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/library/textbooks/[series]/[step]/page.tsx:211 |
| /library/textbooks/[series]/[step]/practice | 36 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/library/textbooks/[series]/[step]/practice/page.tsx:100 |
| /library/vocab | 64 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/ui/ios/InsetRow.tsx:52 |
| /login | 8 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(auth)/login/page.tsx:137 |
| /my | 9 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/layout.tsx:45 |
| /my/books | 13 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/my/books/page.tsx:21 |
| /my/books/[bookId] | 9 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/layout.tsx:45 |
| /my/texts | 9 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/layout.tsx:45 |
| /my/words | 9 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/layout.tsx:45 |
| /pairflip | 28 | 격리 PC 흐름 검증 | apps/web/src/components/pairflip/PairFlipHub.tsx:2 |
| /pairflip/play | 23 | 격리 PC 흐름 검증 | apps/web/src/components/pairflip/PairFlipGameScreen.tsx:210 |
| /pairflip/results | 16 | 격리 PC 흐름 검증 | apps/web/src/components/pairflip/PairFlipResultScreen.tsx:42 |
| /plan | 45 | 정상 PC 렌더 + 격리 기능 검증 | apps/web/src/components/plan/PlanClient.tsx:373 |
| /play/cascade | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/connections | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/daily-blitz | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/ghost-race | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/glyph-tongue | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/letter-forge | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/lexicon-detective | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/lexicon-estate | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/lexicon-hands | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/morpheme-rules | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/morphmerge | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/pirate-quest | 21 | UI 상태 검증 / 3D 전체 흐름 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/silent-rule | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/word-customs | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/word-economy | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/word-orrery | 29 | 격리 PC 흐름 검증 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/wordblitz | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/wordfall-cadence | 14 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /play/wordsmith-vigil | 11 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/layout/SessionFrame.tsx:277 |
| /practice | 17 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/ui/ios/InsetRow.tsx:52 |
| /practice/dcp | 35 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/practice/dcp/page.tsx:65 |
| /pricing | 20 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/marketing/PricingClient.tsx:128 |
| /privacy | 13 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/marketing/LegalPage.tsx:54 |
| /reports | 20 | 정상 PC 렌더 + 격리 기능 검증 | apps/web/src/components/reports/ReportsClient.tsx:39 |
| /reset-password | 13 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(auth)/reset-password/page.tsx:146 |
| /scriptquiz | 21 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/scriptquiz/ScriptQuizQueue.tsx:91 |
| /scriptquiz/play | 30 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/scriptquiz/ScriptQuiz.tsx:320 |
| /settings | 22 | 격리 PC 상태 검증 | apps/web/src/app/(main)/settings/page.tsx:73 |
| /signup | 9 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(auth)/signup/page.tsx:214 |
| /sitemap | 16 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/sitemap/page.tsx:98 |
| /spellforge | 19 | 공통 머리 적용 / 본문 잔여 | apps/web/src/components/hub/TodayQueue.tsx:75 |
| /spellforge/play | 34 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/spellforge/play/page.tsx:110 |
| /teacher | 35 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/teacher/ReceivedAssignments.tsx:60 |
| /terms | 13 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/marketing/LegalPage.tsx:54 |
| /text | 70 | 공통 머리 적용 / 본문 잔여 | apps/web/src/components/ui/ios/InsetRow.tsx:52 |
| /text/[id] | 118 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/text/[id]/page.tsx:258 |
| /text/[id]/comic | 26 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/text/[id]/comic/page.tsx:37 |
| /text/[id]/echo | 39 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/text/[id]/echo/page.tsx:139 |
| /text/new | 65 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/text/new/page.tsx:223 |
| /verify-email | 8 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(auth)/verify-email/page.tsx:99 |
| /video | 13 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/video/ComponentVideo.tsx:89 |
| /video/[id] | 14 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(marketing)/video/[id]/page.tsx:78 |
| /wordblitz | 21 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/wordblitz/page.tsx:98 |
| /wordvault | 30 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/wordvault/hub/WordVaultHub.tsx:59 |
| /wordvault/browse | 24 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/wordvault/WordVaultBrowseClient.tsx:309 |
| /wordvault/review | 17 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/wordvault/StudyMode.tsx:183 |
| /wordvault/study | 17 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/wordvault/StudyMode.tsx:183 |
