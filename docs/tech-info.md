<!-- docs/tech-info.md -->
# 기술정보 목록

외부 기술자료의 출처와 확인 범위를 기록한다. 자료 등록과 실제 설치·제품 적용은 구분한다.

| 번호 | 등록일 | 제목 | 분류 | 상태 |
|---|---|---|---|---|
| TECH-001 | 2026-10-23 | [클로드 유튜브 스킬 11개, 완전 공짜로 풀렸습니다](#tech-001-클로드-유튜브-스킬-11개) | AI 도구 / Claude 스킬 / 영상 제작·운영 | 원본 문서 확인 · 설치 미실행 |

## TECH-001 클로드 유튜브 스킬 11개

- 사용자 제공 영상: [클로드 유튜브 스킬 11개, 완전 공짜로 풀렸습니다](https://www.youtube.com/shorts/1-eh_PiyFp8)
- 영상 제작자 연결 확인: [시스메이커 쇼츠 공장](https://sysmaker.kr/shorts-factory)의 동일 제목·동일 영상 링크.
- 제작자 설명: [유튜브 에이전트 스킬 11개 — 설치 문장·명령 한글 정리](https://sysmaker.kr/go/youtube-agent-skill-11)
- 원본 프로젝트: [Jakeschincariol/youtube-agent-skill](https://github.com/Jakeschincariol/youtube-agent-skill)
- 작성자·라이선스: Jake Schincariol · [MIT LICENSE](https://github.com/Jakeschincariol/youtube-agent-skill/blob/main/LICENSE)
- 확인일: 2026-10-23

Claude에서 유튜브 제작·운영 업무를 나눠 수행하는 스킬 묶음이다. 아래 구성은 영상 전사를 추정한 내용이 아니라 원본 README와 제작자 안내에서 확인한 목록이다.

| 명령 | 기능 |
|---|---|
| `/yt-script` | 대본 작성·훅 후보 평가 |
| `/yt-package` | 제목·썸네일 문구 조합 점검 |
| `/yt-edit` | 자막에서 타임코드가 있는 편집 지점 추출 |
| `/yt-comment` | 댓글 분류·답글 초안 |
| `/yt-plan` | 제작 가능 시간에 맞춘 주간 계획 |
| `/yt-viral` | 채널 자체 평소 성과 대비 인기 영상 탐색 |
| `/yt-retention` | 시청 유지 데이터의 이탈 지점 분석 |
| `/yt-shorts` | 긴 영상에서 쇼츠 후보 구간 추출 |
| `/yt-seo` | 설명·태그·검색어 제안 |
| `/yt-chapters` | 자막 기반 챕터 생성·형식 검사 |
| `/yt-audit` | 채널 진단·우선 개선점 제안 |

원본은 스킬 외에 Python 3 보조 도구 6개를 제공한다. 배포 라이선스는 MIT이며, README는 별도 가입·API 키 없이 사용하는 구성을 설명한다. 자동 업로드·발행은 제공하지 않으며 훅 점수는 조회수를 보장하는 지표가 아니다. 제목의 ‘완전 공짜’는 스킬 배포 기준으로 기록하고, Claude 이용 비용은 이번 확인 범위에 포함하지 않는다.

Vocaflow에서는 영상공장의 대본·제목·자막 편집 절차를 검토할 때 참고할 수 있다. 현재는 자료 등록만 완료했으며 설치·도구 실행·연동·효과 검증은 미실행이다. YouTube 직접 열기가 제한돼 영상 전체·자막은 확인하지 않았고, 제작자 페이지와 원본 README·LICENSE로 보완 확인했다.
