# PC 학습/공개 Tines 잔여 소스 목록

자동 소스 후보이며 AI 미감/정상 화면 판정이 아니다. 관리자·CSAT는 3B, 개발 화면과 모바일은 제외한다. 연결 컴포넌트의 고정 폭·사각 패널·자체 팝업·지역 팔레트를 조사했다. 같은 컴포넌트가 여러 라우트에 연결되면 각 행에 나타난다. `scripts/design/remaining-learning-audit.mjs` 재실행으로 갱신한다.

| 라우트 | 소스 후보 수 | 현재 검증 범위 | 후보 대표 소스 |
|---|---:|---|---|
| / | 13 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/page.tsx:78 |
| /about | 8 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(marketing)/about/page.tsx:91 |
| /arcade | 10 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/arcade/page.tsx:702 |
| /arcade/ranking | 0 | 정상 렌더 및 요소 대조 잔여 | 후보 없음(렌더 미판정) |
| /comics | 0 | 정상 렌더 및 요소 대조 잔여 | 후보 없음(렌더 미판정) |
| /comics/adapted | 4 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/library/browse/ComicsBrowser.tsx:139 |
| /comics/adapted/[bookId] | 2 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/comics/adapted/[bookId]/page.tsx:206 |
| /comics/restored | 11 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/comics/restored/page.tsx:104 |
| /comics/restored/[slug] | 6 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/comics/restored/[slug]/page.tsx:196 |
| /dashboard | 6 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/dashboard/page.tsx:77 |
| /diagnostic | 35 | 격리 PC 상태 검증 | apps/web/src/components/diagnostic/DiagnosticClient.tsx:556 |
| /diagnostic/history | 2 | 격리 PC 상태 검증 | apps/web/src/components/diagnostic/HistoryTimeline.tsx:52 |
| /dictate | 20 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/dictation/DictationHubClient.tsx:139 |
| /dictate/results | 18 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/dictate/results/page.tsx:13 |
| /dictate/session | 32 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/dictate/session/page.tsx:13 |
| /dictate/setup | 21 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/dictate/setup/page.tsx:14 |
| /fit | 23 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(marketing)/fit/page.tsx:201 |
| /fit/s/[payload] | 19 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(marketing)/fit/s/[payload]/page.tsx:62 |
| /flashcard | 9 | 공통 머리 적용 / 본문 잔여 | apps/web/src/components/hub/TodayQueue.tsx:75 |
| /flashcard/play | 20 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/flashcard/play/page.tsx:108 |
| /hub | 13 | 이전 회차 적용 검증 | apps/web/src/app/(main)/hub/page.tsx:71 |
| /hub-lab | 16 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/hub-lab/LabBar.tsx:19 |
| /join/[code] | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(marketing)/join/[code]/page.tsx:77 |
| /library | 0 | 정상 렌더 및 요소 대조 잔여 | 후보 없음(렌더 미판정) |
| /library/books | 51 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/library/browse/BooksExplorer.tsx:437 |
| /library/books/[bookId] | 25 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/library/books/BookDetailClient.tsx:105 |
| /library/scripts | 17 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/library/browse/ScriptsBrowser.tsx:218 |
| /library/scripts/[bookId] | 1 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/library/scripts/[bookId]/page.tsx:388 |
| /library/textbooks | 19 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/library/textbooks/ShelfScreen.tsx:81 |
| /library/textbooks/[series] | 19 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/library/textbooks/ShelfScreen.tsx:81 |
| /library/textbooks/[series]/[step] | 36 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/library/textbooks/[series]/[step]/page.tsx:211 |
| /library/textbooks/[series]/[step]/practice | 20 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/library/textbooks/[series]/[step]/practice/page.tsx:100 |
| /library/vocab | 44 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/library/vocab/VocabSetGrid.tsx:303 |
| /login | 4 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(auth)/login/page.tsx:137 |
| /my | 0 | 정상 렌더 및 요소 대조 잔여 | 후보 없음(렌더 미판정) |
| /my/books | 4 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/my/books/page.tsx:21 |
| /my/books/[bookId] | 0 | 정상 렌더 및 요소 대조 잔여 | 후보 없음(렌더 미판정) |
| /my/texts | 0 | 정상 렌더 및 요소 대조 잔여 | 후보 없음(렌더 미판정) |
| /my/words | 0 | 정상 렌더 및 요소 대조 잔여 | 후보 없음(렌더 미판정) |
| /pairflip | 13 | 격리 PC 흐름 검증 | apps/web/src/components/pairflip/PairFlipHub.tsx:2 |
| /pairflip/play | 14 | 격리 PC 흐름 검증 | apps/web/src/components/pairflip/PairFlipGameScreen.tsx:210 |
| /pairflip/results | 6 | 격리 PC 흐름 검증 | apps/web/src/components/pairflip/PairFlipResultScreen.tsx:42 |
| /plan | 30 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/plan/PlanClient.tsx:372 |
| /play/cascade | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/connections | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/daily-blitz | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/ghost-race | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/glyph-tongue | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/letter-forge | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/lexicon-detective | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/lexicon-estate | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/lexicon-hands | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/morpheme-rules | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/morphmerge | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/pirate-quest | 14 | UI 상태 검증 / 3D 전체 흐름 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/silent-rule | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/word-customs | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/word-economy | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/word-orrery | 22 | 격리 PC 흐름 검증 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/wordblitz | 3 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/wordfall-cadence | 7 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /play/wordsmith-vigil | 4 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/brief/GameBriefModal.tsx:119 |
| /practice | 2 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/hub/TodayQueue.tsx:75 |
| /practice/dcp | 20 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/practice/dcp/page.tsx:65 |
| /pricing | 11 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/marketing/PricingClient.tsx:128 |
| /privacy | 4 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/marketing/LegalPage.tsx:54 |
| /reports | 5 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/reports/ReportsClient.tsx:38 |
| /reset-password | 9 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(auth)/reset-password/page.tsx:146 |
| /scriptquiz | 6 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/scriptquiz/ScriptQuizQueue.tsx:91 |
| /scriptquiz/play | 21 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/game/scriptquiz/ScriptQuiz.tsx:320 |
| /settings | 7 | 격리 PC 상태 검증 | apps/web/src/app/(main)/settings/page.tsx:73 |
| /signup | 5 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(auth)/signup/page.tsx:214 |
| /sitemap | 1 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/sitemap/page.tsx:98 |
| /spellforge | 10 | 공통 머리 적용 / 본문 잔여 | apps/web/src/components/hub/TodayQueue.tsx:75 |
| /spellforge/play | 25 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/spellforge/play/page.tsx:110 |
| /teacher | 20 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/teacher/ReceivedAssignments.tsx:60 |
| /terms | 4 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/marketing/LegalPage.tsx:54 |
| /text | 52 | 공통 머리 적용 / 본문 잔여 | apps/web/src/components/library/textbooks/MyTextbooks.tsx:142 |
| /text/[id] | 105 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/text/[id]/page.tsx:258 |
| /text/[id]/comic | 13 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/text/[id]/comic/page.tsx:37 |
| /text/[id]/echo | 26 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/text/[id]/echo/page.tsx:139 |
| /text/new | 56 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/text/new/page.tsx:223 |
| /verify-email | 4 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(auth)/verify-email/page.tsx:99 |
| /video | 4 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/video/ComponentVideo.tsx:89 |
| /video/[id] | 5 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(marketing)/video/[id]/page.tsx:78 |
| /wordblitz | 12 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/app/(main)/wordblitz/page.tsx:98 |
| /wordvault | 12 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/wordvault/hub/WordVaultHub.tsx:59 |
| /wordvault/browse | 14 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/wordvault/WordVaultBrowseClient.tsx:309 |
| /wordvault/review | 8 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/wordvault/StudyMode.tsx:183 |
| /wordvault/study | 8 | 정상 렌더 및 요소 대조 잔여 | apps/web/src/components/wordvault/StudyMode.tsx:183 |
