# 참조 사이트 — 컴포넌트 전수 목록

> 생성 `scripts/design/extract-components.mjs` · 2026-09-21 · 손으로 고치지 말 것. 이름·수치만(CSS 원문 0).
> 33페이지 · 스타일시트 42 · 이름 313(DOM 에 실재 156). 계열은 이름 규칙으로 기계 분류. 매핑은 `docs/design/tines-mapping.md`.

## 계열별 개수

| 계열 | 이름 수 | DOM 실재 | 여러 페이지(≥3) |
|---|---|---|---|
| 내비 · 헤더 | 12 | 6 | 3 |
| 푸터 | 2 | 2 | 1 |
| 검색 | 5 | 0 | 0 |
| 모달 · 팝업 · 툴팁 | 6 | 0 | 0 |
| 버튼 · 링크 | 16 | 10 | 3 |
| 폼 · 입력 | 19 | 10 | 5 |
| 탭 · 펼침 · 캐러셀 | 8 | 6 | 0 |
| 표 · 목록 · 격자 | 31 | 20 | 2 |
| 카드 | 39 | 17 | 1 |
| 히어로 · 머리 | 19 | 11 | 3 |
| CTA 띠 | 3 | 3 | 2 |
| 매체 · 삽화 | 27 | 17 | 3 |
| 본문 · 서식 | 19 | 13 | 1 |
| 구간 틀 | 42 | 19 | 2 |
| 기타 | 65 | 22 | 0 |

## 내비 · 헤더 (6)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| SiteNav26 | 21 | 1092 | span div a | 541×32 | 50px 20px | Roobert 16px/500 | :hover ::placeholder | ○ |
| NavSearch | 21 | 21 | button | 38×38 | 990px | Roobert 16px/400 | :hover | — |
| AreaNav | 18 | 332 | div span a | 154×28 | 50px 990px | Roobert 16px/400 | :hover | ○ |
| PageSectionHeader | 1 | 23 | div span a | 480×118 | 23px | Roobert 16px/400 | :hover | — |
| ArticlePageHeader | 1 | 10 | div span h1 | 143×42 | 50% 26px | Roobert 14px/400 | :hover | — |
| AnnouncementBar | 1 | 4 | span div a | 219×30 | 28px | Roobert 14px/600 | :hover | — |

## 푸터 (2)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| SiteFooter26 | 21 | 2793 | a div span | 168×636 | — | Roobert 14px/500 | aria-expanded :hover | ○ |
| WcmFooterSection | 1 | 8 | div h2 p | 776×254 | 12px | Roobert 16px/400 | — | — |

## 버튼 · 링크 (10)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| Button | 19 | 222 | span a button | 140×36 | 9990px | Roobert Mono 13px/700 | :disabled :hover :focus :active | ○ |
| CtaButtons | 15 | 34 | div span | 288×36 | — | Roobert 16px/400 | — | — |
| DocsThemeToggle | 3 | 9 | span button | 30×30 | 999px | Roobert 16px/400 | :hover :focus-visible :focus | ○ |
| ArticleEntryLink | 2 | 99 | div a header | 497×290 | 10px 22px | Roobert 16px/400 | — | — |
| SolutionChildEntryLinkCard | 2 | 55 | div a header | 358×76 | 14px | Roobert 16px/400 | :hover | ○ |
| CollectionViewToggle | 2 | 13 | svg span div role=group | 19×18 | 10.5px 10.5px 0px 0px 18px | Roobert 14px/600 | :hover | ○ |
| DocumentEntryLink | 1 | 14 | p a div | 322×417 | 6px | Roobert 16px/400 | — | — |
| SubmitStoryCtaPageSection | 1 | 4 | div h2 p | 772×138 | 24px | Roobert 16px/400 | — | — |
| HeroIntercomLink | 1 | 1 | a | 135×17 | — | Roobert 16px/700 | :hover | — |
| PromptActionButton | 1 | 1 | button | 128×30 | 990px | Roobert Mono 12px/700 | — | — |

## 폼 · 입력 (10)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| FlowerField | 21 | 47 | canvas | 966×393 | — | Roobert 16px/500 | — | — |
| WildCodeField | 15 | 15 | div role=img | 1360×299 | — | Roobert 16px/400 | — | — |
| WithCustomInlineFormatting | 11 | 60 | p h3 h2 | 143×70 | — | Reckless 16px/400 | — | — |
| Checkbox | 3 | 15 | label input span | 16×16 | 3px | Roobert 14px/500 | :checked :focus-visible :focus | ○ |
| ConsentCheckboxes | 3 | 8 | label div | 620×18 | — | Roobert 14px/500 | :hover | — |
| NewsletterSection | 2 | 27 | div input section | 620×91 | 6px 0px 0px 0px 6px 0px 0px | Roobert 16px/500 | :hover :focus ::placeholder | ○ |
| ContactSupportForm | 1 | 3 | div form | 550×212 | 8px 0px 0px 14px 14px | Roobert 16px/400 | — | — |
| ThreeBHeroFlowerFields | 1 | 3 | div | 816×452 | — | Roobert 16px/400 | — | ○ |
| TextInput | 1 | 2 | input | 550×48 | 8px 8px 0px 0px | Roobert 16px/500 | :hover :focus ::placeholder :disabled | ○ |
| Textarea | 1 | 1 | textarea | 550×128 | — | Roobert 16px/500 | :hover :focus ::placeholder :disabled | ○ |

## 탭 · 펼침 · 캐러셀 (6)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| HomeLogoMarquee | 2 | 48 | span div | 133×30 | — | Roobert 16px/400 | :active | ○ |
| WcmDial | 1 | 873 | span button a role=checkbox | 385×144 | 6px 4px | Roobert 16px/400 | :hover :focus ::placeholder :focus-visible | ○ |
| LibraryTable | 1 | 48 | td a tr | 465×55 | 999px 4px | Roobert 16px/500 | :hover :active | — |
| TimelineScrubber | 1 | 30 | div svg button | 45×14 | 3px 50% | Roobert 13px/400 | :hover :focus-visible :focus | ○ |
| ThreeBFaqSection | 1 | 27 | div details summary | 1360×90 | — | Roobert 16px/400 | open] | — |
| PricingFaqSection | 1 | 21 | div details summary | 1360×93 | — | Roobert 16px/400 | open] | — |

## 표 · 목록 · 격자 (20)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| DotGridPattern | 5 | 46 | div | 483×318 | — | Roobert 16px/400 | — | — |
| G2BadgeList | 3 | 21 | li ul | 155×161 | — | Roobert 16px/400 | :hover | — |
| AccreditationGrid | 2 | 70 | div a span | 360×360 | 24px 999px | Roobert 16px/400 | :hover | ○ |
| LibraryDirectoryHero | 2 | 14 | div header p | 552×258 | 24px 24px 24px 0px 0px | Roobert 16px/400 | :hover | — |
| CaseStudyGridSection | 2 | 4 | div footer | 1128×858 | — | Roobert 16px/400 | — | — |
| SolutionChildPageGridSection | 2 | 4 | header div | 1128×803 | — | Roobert 16px/400 | — | — |
| EventDirectoryCard | 1 | 393 | div span a | 278×20 | 990px 12px | Roobert 14px/400 | :hover | ○ |
| ThreeBBentoSection | 1 | 156 | div p figure role=img | 365×341 | 14px 48px | Roobert 16px/400 | — | ○ |
| CollectionEntryCard | 1 | 50 | a div header | 149×167 | 14px 12px | Roobert 14px/400 | — | — |
| PartnersDirectorySection | 1 | 14 | div header h3 | 606×576 | 14px | Roobert 16px/400 | :hover | — |
| EventsDirectory | 1 | 11 | div button h1 role=group | 233×38 | 140px 0px 0px 140px 0px 140px 140px 0px | Roobert 16px/400 | :hover :focus-visible :focus ::placeholder | ○ |
| GridCanvas | 1 | 9 | div | 650×236 | 14px 280px | Roobert 14px/400 | — | ○ |
| PricingQuotesGrid | 1 | 7 | div p blockquote | 774×188 | 14px 0px 0px 14px 0px 14px 14px 0px | Roobert 16px/400 | — | — |
| PartnerDirectory | 1 | 4 | div input a | 1360×46 | 990px | Roobert 16px/400 | :focus ::placeholder :hover | — |
| StoryGridPageSection | 1 | 4 | div svg | 1000×590 | — | Roobert 16px/400 | — | — |
| DataCardGrid | 1 | 3 | div dl | 333×129 | 10px | Roobert 18px/400 | — | — |
| CollectionsGridPageSection | 1 | 2 | div | 1000×798 | — | Roobert 16px/400 | — | — |
| CollectionAllStoriesView | 1 | 1 | div | 1×1 | — | Roobert 16px/400 | — | — |
| CollectionPageView | 1 | 1 | div | 1000×6954 | — | Roobert 16px/400 | — | — |
| ToolsDirectory | 1 | 1 | span | 48×52 | — | Roobert 16px/400 | — | — |

## 카드 (17)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| CaseStudyBookCard | 3 | 280 | div a svg | 360×270 | 24px 4px 12px 12px 4px | Roobert 16px/400 | :hover :active | ○ |
| LibraryStoryCard | 2 | 202 | span a div | 435×44 | 50% 24px | Roobert 16px/400 | :hover | ○ |
| CustomerG2ReviewCard | 2 | 180 | div blockquote h3 | 296×61 | 24px 0px 0px 24px 24px | Roobert 16px/400 | :hover | — |
| WhatsNewCard | 2 | 107 | span div img | 433×48 | 12px | Roobert 14px/400 | :hover | ○ |
| ContentCardBase | 2 | 16 | a div | 264×366 | 8px | Roobert 16px/400 | :hover | ○ |
| LibraryStoryRequestPromptCard | 2 | 12 | a div h3 | 253×18 | 14px | Roobert 14px/500 | :hover | — |
| ContentCardArticle | 2 | 5 | a header | 264×340 | 8px | Roobert 16px/400 | — | — |
| ContentCardGeneric | 2 | 3 | a | 264×340 | 8px | Roobert 16px/400 | — | — |
| PartnerEntry | 1 | 94 | div a h4 | 293×41 | 8px | Roobert 16px/400 | :hover | — |
| LibraryToolCard | 1 | 42 | span a | 91×48 | 14px | Roobert 16px/600 | :hover | ○ |
| ContentCard | 1 | 21 | span a video | 214×76 | 10px | Roobert 16px/400 | :hover | ○ |
| PricingPlanCards | 1 | 21 | div span article | 490×61 | 14px 0px 0px 9px 9px | Roobert 16px/500 | :active | — |
| ThreeBExampleCard | 1 | 16 | span a img | 614×40 | 16px 0px 0px 9px 9px | Roobert 16px/400 | :hover :focus-visible :focus | — |
| QuoteCardNeue | 1 | 12 | div footer | 550×157 | 14px | Roobert 16px/400 | — | — |
| FeatureHighlightCard | 1 | 10 | div header p | 358×294 | 14px | Roobert 16px/400 | :hover | — |
| BlogArticleExcerptSection | 1 | 6 | div p | 788×326 | — | Roobert 16px/400 | :hover | — |
| ContentCardDocument | 1 | 3 | div a | 80×104 | 8px | Roobert 16px/400 | — | — |

## 히어로 · 머리 (11)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| SectionHeading2 | 5 | 13 | h2 | 1128×48 | — | Reckless 46px/400 | — | — |
| SolutionHero | 3 | 26 | div section h1 | 960×124 | — | Roobert 16px/400 | — | — |
| SolutionPageAllcapsHeading | 3 | 3 | p | 960×16 | — | Roobert Mono 11.5px/700 | — | — |
| ThreeBHero | 2 | 23 | div section h1 role=img | 1440×276 | 42px | Roobert 16px/400 | — | ○ |
| CaseStudiesHero | 2 | 16 | div header img | 1128×447 | — | Roobert 16px/400 | — | — |
| ComboFontHeading | 2 | 12 | span h2 | —×— | — | Roobert 42px/600 | — | — |
| HeroHeadlineDecoration | 2 | 2 | div | 960×0 | — | Roobert 16px/400 | — | — |
| CaseStudyHeroSection | 1 | 11 | div section h1 | 604×224 | 16px 32px | Roobert 16px/400 | — | — |
| HomeSectionKicker | 1 | 4 | p | 653×13 | — | Roobert Mono 13px/700 | — | — |
| HomeSectionHeading | 1 | 3 | h2 | 616×118 | — | Roobert 56px/400 | — | — |
| HomeSectionByline | 1 | 2 | p | 768×90 | — | Reckless 24px/400 | — | — |

## CTA 띠 (3)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| WildCodeCTASection | 15 | 60 | div section p | 1360×299 | — | Roobert 16px/400 | — | — |
| ExplosionCTASection | 3 | 60 | div section footer | 1239×812 | 12px 0px 0px 12px 12px | Roobert 16px/400 | — | ○ |
| ThreeBCodaSection | 1 | 4 | p section img | 768×166 | — | Roobert 16px/400 | — | — |

## 매체 · 삽화 (17)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| InteractiveCursor | 15 | 165 | svg div | 38×40 | — | Roobert 16px/400 | — | ○ |
| WildCodeFlowers | 15 | 15 | canvas | 1541×479 | — | Roobert 16px/400 | — | — |
| CurrentColorRemoteSvg | 6 | 36 | span role=img | 100×26 | — | Roobert 16px/400 | — | — |
| ThreeBMascot | 2 | 19 | g text circle | 25×25 | — | Roobert 16px/400 | — | ○ |
| PageIconDispatcher | 2 | 2 | div | —×— | — | Roobert 16px/400 | — | — |
| ThreeBMascotOrb | 2 | 2 | svg | 55×55 | — | Roobert 16px/400 | — | — |
| VideoPlayer | 1 | 40 | div span svg | 164×24 | 999px 50% | Roobert 16px/400 | :focus-visible :focus :hover | ○ |
| StargazingConstellation | 1 | 27 | path g | 5×5 | — | Roobert 16px/400 | — | ○ |
| PartnerLogo | 1 | 24 | div img | 293×147 | 14px | Roobert 16px/400 | — | — |
| ThreeBAccessMapThumb | 1 | 19 | g path | 56×22 | — | Roobert 16px/400 | — | ○ |
| WcmCursorHint | 1 | 6 | div span button role=note | 52×30 | 10px 2px | Roobert 13px/400 | :hover | ○ |
| PublicSectorLayeredProductVisual | 1 | 4 | div | 1440×623 | — | Roobert 16px/400 | — | — |
| ThreeBProductVisual | 1 | 4 | div svg | 1360×680 | — | Roobert 16px/400 | — | ○ |
| AvatarFace | 1 | 2 | g | 11×14 | — | Roobert 16px/400 | — | ○ |
| VideoBlock | 1 | 2 | figure div | 936×532 | 14px | Roobert 18px/400 | — | — |
| EventsWorldMap | 1 | 1 | div | 1360×450 | 12px | Roobert 16px/400 | — | — |
| FlowerSticker | 1 | 1 | svg | 46×40 | — | Roobert 16px/400 | — | — |

## 본문 · 서식 (13)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| Article | 3 | 3 | article div | 828×1211 | — | Roobert 18px/400 | :hover | ○ |
| SolutionPageQuoteSection | 2 | 22 | div p blockquote role=img | 742×164 | 14px 0px 0px 14px 0px 14px 14px 0px | Roobert 14px/400 | — | — |
| ThreeBExampleArticle | 1 | 44 | div span a | 506×29 | 990px 4px | Roobert 16px/400 | :hover :focus-visible :focus | ○ |
| ThreeBPullQuote | 1 | 14 | span figure blockquote | 336×59 | 42px 14px | Roobert 14px/400 | — | — |
| CenteredQuoteSection | 1 | 8 | p div section | 1080×47 | — | Roobert 16px/400 | :hover | ○ |
| DefaultSidebarContent | 1 | 5 | a div h3 | 216×90 | 14px | Roobert 14px/400 | :hover | ○ |
| PullQuote | 1 | 5 | div blockquote span | 590×221 | 14px | Roobert 18px/400 | — | — |
| HomeContent | 1 | 4 | span div section | 1440×1472 | — | Roobert 16px/400 | — | — |
| StructuredTextBlock | 1 | 3 | div | 680×266 | 14px | Roobert 18px/400 | — | — |
| ThreeBPageContent | 1 | 3 | div section | 1440×1195 | — | Roobert 16px/400 | — | — |
| CaseStudyContent | 1 | 2 | div article | 1440×3530 | — | Roobert 16px/400 | — | — |
| HomeContentSections | 1 | 1 | div | 1440×3794 | — | Roobert 16px/400 | — | — |
| SolutionForRelatedContentSection | 1 | 1 | div | 1128×340 | — | Roobert 16px/400 | — | — |

## 구간 틀 (19)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| PageBackdrop | 21 | 42 | div | 1440×6040 | — | Roobert 16px/400 | — | — |
| PageSection | 8 | 58 | section div | 1440×586 | — | Roobert 16px/400 | — | — |
| SolutionPageValuePropsSection | 2 | 46 | div article h3 | 298×168 | 14px | Roobert 16px/400 | — | — |
| RecognitionAndBadgesSection | 2 | 18 | div section h2 | —×— | — | Roobert 16px/400 | — | — |
| SolutionPageSecondaryDescription | 2 | 2 | div | 1128×81 | — | Roobert 16px/400 | — | — |
| HomeUseCasesSection | 1 | 52 | span div button role=tab role=tablist role=tabpanel | 832×172 | 14px 14px 0px 0px 999px | Roobert 16px/400 | :focus-visible :focus aria-selected | ○ |
| SolutionForUseCasesSection | 1 | 39 | div button article | 200×54 | 8px 14px | Roobert 16px/400 | :hover | ○ |
| HomeUSPSection | 1 | 26 | div figure img role=img | 653×272 | 14px | Roobert 16px/400 | — | — |
| HomeSolutionSection | 1 | 23 | div p h3 | 555×308 | 48px | Roobert 16px/400 | — | ○ |
| HowItWorksPageSection | 1 | 11 | div svg h2 | 358×126 | 24px | Roobert 16px/400 | — | — |
| SolutionForPartnersSection | 1 | 10 | div header | 227×90 | — | Roobert 16px/400 | — | — |
| SolutionForExamplesSection | 1 | 7 | a header div | 206×235 | 14px | Roobert 18px/400 | :hover | — |
| WhatsNewSection | 1 | 7 | div section header | 613×144 | 14px | Roobert 16px/400 | :hover | ○ |
| ThreeBExploreSection | 1 | 6 | div section h2 | 577×453 | — | Roobert 16px/400 | — | — |
| ThreeBExamplePage | 1 | 5 | div article nav | 1360×205 | — | Roobert 16px/400 | — | — |
| CaseStudyReadMoreSection | 1 | 3 | div h2 | 1128×39 | — | Roobert 16px/400 | — | — |
| FileAttachmentSection | 1 | 3 | div span role=button | 502×121 | 7px | Roobert 16px/400 | :hover :disabled | ○ |
| SolutionForFeatureHighlightsSection | 1 | 3 | header p div | 1128×349 | — | Roobert 16px/400 | — | — |
| ToolsPageSection | 1 | 2 | svg div | 1000×590 | — | Roobert 16px/400 | — | — |

## 기타 (22)

| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |
|---|---|---|---|---|---|---|---|---|
| LibrarySidebar | 2 | 70 | div span svg | 288×41 | 990px | Roobert 16px/400 | ::placeholder :hover :focus | ○ |
| RatingStars | 2 | 20 | div | 98×16 | — | Roobert 16px/400 | — | — |
| StoryAuthorsDisplay | 2 | 19 | span | 207×18 | — | Roobert 14px/500 | — | — |
| AllCaps | 2 | 2 | p | 552×16 | — | Roobert Mono 11.5px/700 | — | — |
| ThreeBPromptTyper | 1 | 31 | span | 13×24 | 1px | Roobert Mono 20px/500 | — | ○ |
| ThreeBDependencyGraph | 1 | 20 | g path | 68×25 | — | Roobert 16px/400 | — | ○ |
| StoryEmbed | 1 | 18 | div span p | 256×428 | 50% 14px | Roobert 16px/400 | :hover | ○ |
| PersonInfoItem | 1 | 10 | div p img | 365×48 | 50% | Roobert 16px/400 | — | — |
| AngularGradientBorder | 1 | 8 | rect div svg | 125×27 | — | Roobert Mono 12px/700 | — | ○ |
| ThreeBChatMock | 1 | 7 | span div svg | 115×26 | 999px 1px | Roobert 11.5px/400 | — | ○ |
| ThreeBTestClock | 1 | 7 | path svg g role=img | 49×29 | — | Roobert 16px/400 | — | ○ |
| HomeMonitorBanner | 1 | 5 | div canvas role=img | 1440×1016 | — | Roobert 16px/400 | — | — |
| LibraryFindAndFilterBar | 1 | 5 | div input select | 796×50 | 0px 0px 0px 14px 0px 0px 14px | Roobert 14px/500 | :focus ::placeholder :hover | ○ |
| HomeAiTangleBanner | 1 | 4 | div p h2 | 440×260 | — | Roobert Mono 13px/700 | — | — |
| InfoBox | 1 | 2 | div | 828×54 | 8px | Roobert 16px/400 | — | — |
| BellSticker | 1 | 1 | svg | 38×40 | — | Roobert 16px/400 | — | — |
| HandsSticker | 1 | 1 | svg | 40×39 | — | Roobert 16px/400 | — | — |
| LightbulbSticker | 1 | 1 | svg | 28×44 | — | Roobert 16px/400 | — | — |
| PenSticker | 1 | 1 | svg | 36×36 | — | Roobert 16px/400 | — | — |
| ScrollSticker | 1 | 1 | svg | 39×37 | — | Roobert 16px/400 | — | — |
| ThreeBExploreGarden | 1 | 1 | div | 420×453 | — | Roobert 16px/400 | — | — |
| ThreeBHundredXBanner | 1 | 1 | div role=img | 1454×760 | — | Roobert 16px/400 | — | — |
