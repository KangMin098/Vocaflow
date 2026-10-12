# Vocaflow v3.1 — 원문 이해 교수 모델

2026-10-12 사용자 첨부 보완안에 대한 **구현 설계와 Claude Code 작업 지시문**이다. 제품 구현 완료 문서가 아니다.

Claude Code는 [CLAUDE_CODE_WORK_ORDER.md](CLAUDE_CODE_WORK_ORDER.md)를 읽고 시작한다. 설명의 근거는 [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md), 교수·화면·콘텐츠 계약과 실제 제시 사례는 [MEANING_SUPPORT_DESIGN.md](MEANING_SUPPORT_DESIGN.md)에 있다. 독립 계획 검토는 [REVIEW.md](REVIEW.md)에 기록한다.

앱·공개 자료 기준: `521944f227c9cf5b957cb8b366fb27a6d81a3d42`(PR #235). 최종 main 대조: `b691cb7f2d93df46725c2bd87483b2b49f1998c6`(PR #236, E2E/문서 보강). 두 커밋 사이 앱/공개 자료 diff 0. 착수 때 최신 main과 다시 대조한다.

- 기존 일곱 장면 유지, `scene=meaning` 안의 선택적 교수 지원 보강.
- PC 1280·1440 **라이트**. 다크는 사용자 결정으로 제외, 모바일 제외.
- 메뉴·강의 확장·학평·비공개 비교 12쌍은 보류 유지.
- 기존 786문항의 분석·검수·비교·원리 노트를 재생성하지 않는다.
- 새 설명은 별도 검수·공개 결속으로 파일럿부터 만든다.
- 기술·사용성·교육 효과를 구별한다. 이번 문서의 교육 효과는 미검증이다.

첨부는 보완안과 요청문이다. 첨부가 언급한 별도 223줄 다운로드 문서의 본문은 제공되지 않았고 검토했다고 주장하지 않는다. v3 설계 PR #223의 전체 문서는 main에 없고, #236에서 v3/M5_RELEASE_CHECK.md만 추가되었다. 없는 설계 파일을 구현 정본처럼 참조하지 않는다. 필요한 요구사항은 본 설계에 직접 명시했다.
