# 기출 Evidence 운영 체계 감사와 재설계

## 조사 범위와 변경 전 관찰

2026-09-18 localhost:3000, 실제 DB와 로그인한 브라우저로 확인했다. 문항 802, body_ok=false 112, 배점 모순 1, 복수 정답 1은 DB 직접 질의 결과다. 화면은 학습자 해부 준비 7/802, 원천 결함 721/802, 인용 미정착 24, 리포트 작업 로그 591, 계수 불일치 259를 표시했다. 이 수치는 당시 관찰이며 UI 상수로 사용하지 않는다.

- 첫 화면: 필드 키 12개와 셀 산술이 운영 상태보다 앞선다. 서로 다른 두 기준을 모두 배포 기준처럼 읽게 한다. 5초 내 배포 판단이 어렵다.
- 30초 진단: 긴 결함 설명 → 유형 보고서 → 매트릭스 → 문항 순서다. 조치를 결정하기 전에 같은 모집단을 여러 번 읽는다.
- 실제 interaction: 지문 잘림 × 빈칸 추론 80 셀을 클릭하면 두 필터가 적용된다. 하지만 문항 목록이 아래에 남고, 문항 상세는 원문 링크·변경 이력·조치가 없다. 선택 문항은 URL에 남지 않는다. replaceState만 써 뒤로가기로 조사 맥락을 복원하지 못한다.
- 오류: 관리자 개발 진입은 통과하지만 학습자 RLS 조회가 빈 분석을 반환하면 전체 페이지가 죽었다. 로그인 후에는 정상 렌더됐다. 조회 오류와 데이터 결손은 구분해야 한다.
- 캐시: 해부 카탈로그 10분 캐시 때문에 새로고침 안내와 재검증 의미가 일치하지 않는다.

## 코드·데이터 지도와 분류

| 정보 / 기능 | 정본 | 분류 / 배치 |
|---|---|---|
| RSC·admin 인증 | admin/csat/evidence/page.tsx, requireAdmin, middleware | 운영 입구, 유지 |
| DB 최신 분석·3인 검수·6결함 | lib/csat/evidence.ts, evidence-fold.ts | 품질 진단 / 작업 큐 |
| 학습자 실제 후보·12필드 | dissect-catalog.ts, dissect.ts readyItem, session/catalog.ts | 운영 상태 / 배포 판단 |
| 앵커·메타·공식·이력 | dissect-anchors.json, skeleton-data, dissect-metadata.ts, lecture/store | 문항 상세 / 수정 위치 |
| 피벗·합계·필터 | evidence-fold.ts (8축×4측정값) | 고급 진단, 보존 |
| 유형 보고서·함정 계열 | EvidenceAxisPanel, guide-fold.ts | 진단 펼침, 원 라벨 보존 |
| 상세 분석 API | api/admin/csat/items, lib/csat/items.ts | inspector, 원문은 제외 |
| 원문 | kice-source.ts, admin/kice/item/[slug] | 원본 링크, 서버 프록시 금지 |
| 재분석 | analysis-drain-export --redo → 에이전트 → validate → import | 조치 작업 묶음, DB 자동 변경 없음 |
| 리포트 재작성 | locus-refold export/import, analysis-drain-import | 조치 상세, 덮어쓰기·백업 주의 |
| 산출물 | api/admin/csat/guide MD/JSON | 기술 상세, 전량 다운로드 명시 |
| 자동 검사 | console-render.test, 47-csat-session, scripts/csat/test-* | 구현 검증. 결과를 운영 상태로 대체하지 않음 |
| 스크립트·raw 내부 표지·계수 | 도움말 csat-evidence, type report | 기술 상세 / 처리 절차 |

원문 적격 /admin/csat/sources는 교재 재료의 재사용 적격 판정이며 개별 평가원 문항의 body_ok와 다른 데이터다. 이를 문항 원문 적격으로 오인시키는 링크는 만들지 않는다. DB migration·새 dependency·학습자 데이터 변경은 필요 없다.

## 방향 비교와 선택

| 방향 | 장점 | 손실 / 판단 |
|---|---|---|
| A 운영 콘솔 | 상태 → 권장 조치 빠름 | 피벗을 없애면 유형·회차 교차 조사 손실 |
| B 품질 워크벤치 | 축과 필터로 깊이 조사 | 첫 화면의 운영 질문을 여전히 관리자가 계산해야 함 |
| C 통합 | 운영 요약 → 큐 → 같은 맥락의 문항·상세, 피벗은 펼침 | 3개 얕은 view로 역할 분리. 선택 |

한 라우트와 URL 기반 3개 view(운영 현황·작업 큐·문항 탐색), 문항 inspector를 사용한다. 기존 row/col/m 및 8축 필터 딥링크를 보존한다. 상태·검색·필드 부족·검증 단계·문항 선택도 URL에 담는다. 뒤로가기와 새로고침이 같은 조사 상태를 재현한다.

자산 의존: 최신 분석·실측 결함·학습자 카탈로그의 교집합이 있어야 운영 판단이 성립한다.
즉시 증명: 집계 클릭 → 같은 데이터의 해당 문항 목록을 로컬에서 계산한다.
인지 부하 개선: 첫 화면은 배포 준비와 다음 조치, 상세 근거는 요청 시 공개한다.

## 판정 계약

- 학습자 준비는 기존 readyItem 판정 그대로. 원천 품질 결함 수로 대신하지 않는다. 준비된 문항에도 별도의 운영 검토가 남을 수 있다.
- 파이프라인은 학습자 필수 필드의 누적 검사다. 단계 차단은 해당 단계에서 처음 탈락한 고유 문항, 단계별 부족은 중복 가능하다. 원문 손상은 별도 선행 품질 점검이다.
- 심각도(학습 후보 제외/원천 신뢰성/보고서 점검)와 작업 우선순위(원문·채점 → 분석·연결 → 학습 메타 → 보고서)를 구분한다. 같은 순위 안에서 영향 문항 수를 쓴다. 자동 복구 가능성을 추정하지 않는다.
- 재검증은 DB와 현재 배포 코드의 정적 자산을 다시 읽는다. admin 조회는 learner 캐시를 재사용하거나 덮지 않는다. 오류는 판정 불가로 유지한다.
- 재분석 작업 묶음은 다운로드만 한다. 실행되지 않은 재분석을 예약/완료로 표시하지 않는다. import는 기존 게이트와 백업 절차를 따른다.

## 검증 기록

- 실제 DB를 사용한 1280×900 첫 화면: 준비 7/802, 제외 795, 별도 원천 검토 721, 첫 작업 지문 잘림 112. 상태와 첫 행동이 접힌 위에서 보인다. 숫자는 당시 검사 결과다.
- 작업 큐 → 112문항 → M2706#33 상세에서 실제 분석·공식 원문 링크·앵커 부족·4개 분석 버전을 확인했다. 개발 모드 effect 정리 때 발생하던 거짓 시간초과 오류를 수정했다.
- 키보드 Escape 및 원래 문항 포커스 복귀, 뒤로가기·새로고침의 필터/선택 복원, 검색 빈 결과 복구를 검증했다. 상세 패널은 배경 inert·포커스 가두기·본문 스크롤 잠금을 사용한다.
- 결함×유형 셀의 수와 결과 문항 수를 대조했다. 같은 다중 축의 서로 다른 두 값을 고른 셀은 기존 OR 필터와 분리한 AND 조건으로 보존한다. 0 셀도 방향키 이동을 끊지 않는다.
- 실제 재검증 성공 및 503 실패 주입 → 판정 보류·CTA 비활성 → 실제 API 재시도 복구를 확인했다. DB를 쓰거나 배치 처리를 실행하지 않았다.
- 390·768·1280px, light/dark 총 6개 조합의 본문 넘침 0·axe WCAG A/AA 위반 0. 처음 발견한 다크 모드 보라 텍스트/CTA 대비 부족은 기존 토큰의 혼합으로 고쳐 다시 통과했다. 모바일 상세도 axe 위반 0.
- 관련 Vitest 7파일 45개 통과: 운영 집계/URL/64축 조합, 원장 불일치·조회 실패, API 관리자 거절·no-store, 기존 문항 판정·도움말·API caller 회귀. TypeScript 전체 검사 및 변경 코드 ESLint 통과.
- Playwright 3개 시나리오 통과(동작 2개 + 대비 수정 후 반응형 1개 재실행). 전체 저장소 build·전체 e2e는 실행하지 않았다.

캡처는 `apps/web/test-results-csat-learner/evidence-operations/`에 저장했다:

- [데스크톱 운영 현황](../../apps/web/test-results-csat-learner/evidence-operations/overview-1280-light.png)
- [다크 운영 현황](../../apps/web/test-results-csat-learner/evidence-operations/overview-1280-dark.png)
- [모바일 운영 현황](../../apps/web/test-results-csat-learner/evidence-operations/overview-390-light.png)
- [작업 큐](../../apps/web/test-results-csat-learner/evidence-operations/work-queue.png)
- [문항 검토](../../apps/web/test-results-csat-learner/evidence-operations/inspector-1280.png)
- [모바일 문항 검토](../../apps/web/test-results-csat-learner/evidence-operations/inspector-390.png)

## 운영 경계

- UI의 조치는 대상 추출·원문/분석 확인·기존 수정 위치 안내·읽기 재검증이다. 재분석/적재/발행 job 저장소와 실행 API는 기존에 없으며 새로 가장하지 않았다. 작업 묶음은 실행 이력이 아니다.
- 필드/보고서만 고칠 대상에는 무조건 재분석 명령을 처방하지 않는다. 원문·인용·핵심 분석 문제일 때만 redo 준비 명령을 제공한다.
- 배포된 정적 앵커·메타를 읽으므로 파일 변경은 코드 배포 후 반영된다. 이력을 위한 새 DB 테이블·migration·외부 의존성 추가는 없다.
- 기존 공유 워크스페이스의 광범위한 미커밋 변경(새 학습자 카탈로그와 자산 포함)을 보존했다. 이 변경에 필요한 미커밋 선행 코드와 타 작업 파일을 임의로 커밋하거나 푸시하지 않는다.
