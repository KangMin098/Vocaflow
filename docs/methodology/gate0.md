# Methodology Intelligence — Gate 0

조사일: 2026-09-19. 작업 브랜치 `feat/methodology-intelligence`, 기준 `dc148722`.
원래 워크트리의 미커밋 변경은 이 작업에 포함하지 않는다. 사용자 요청 0–26항을 구현 범위로 삼는다.
첨부는 `# 27`에서 끝나며 이후 요구사항은 제공되지 않았다.

## 현재 자산과 경계

| 영역 | 확인한 구현/실측 | 결정 |
|---|---|---|
| Admin | `app/admin/layout.tsx`, `lib/auth/require-admin*.ts`, `components/admin/AdminSidebar.tsx` | 기존 3층 인증 재사용. 새 인증 체계 없음 |
| DB | Supabase/Postgres; `scripts/lib/supabase-client.mjs`, `lib/supabase/admin.ts` | 기존 클라이언트와 환경변수 재사용. ORM 추가 없음 |
| 원천 | DB `csat_source_registry`, `topic_corpus_sources` 열 직접 조회 | 각각 문항용 원문 적격·어휘 주제 통계용. 전문가/주장 관계를 억지로 저장하지 않음 |
| 방법론 | DB `to_regclass('public.methodologies')`, `to_regclass('public.experts')` 조회: 둘 다 없음 | 전용 provenance 모델 필요. 마이그레이션은 검토 후 적용 |
| CSAT | DB `csat_types` 직접 조회: 26 ID; `lib/csat/evidence.ts`, `evidence-fold.ts` | `R-BLANK`, `R-ORDER`, `R-INSERT` 등 실제 ID를 참조. 새 유형 목록으로 대체하지 않음 |
| 자막 | `lib/topic-corpus/ted-transcript.ts` | 메모리에서 처리하고 원문은 버리는 원칙 재사용. TED 파서는 YouTube 파서가 아님 |
| YouTube | `.ts/.mjs/.sql` 검색에서 생산용 자막 수집기 미발견. 이전 채널 조사에서 51개 메타데이터만 확보 | 공식 API 메타데이터/허용된 사용자 자막 경로. 빈 응답은 성공/분석완료 아님 |
| 드레인 | `scripts/csat/analysis-drain-{export,validate,import}.mjs` | export → 에이전트 판정 → 검증 → import. API 키가 없다고 분석 자체를 대기하지 않음 |
| 검색 | 기존 도서 `search_vector`/GIN | 초기 방법론은 구조 필터·텍스트 검색. 임베딩/벡터 DB 추가 없음 |
| 추천 | `lib/recommend/decide.ts`, `get-next-action.ts`, `lib/library/recommend-books.ts` | 연구 방법론을 자동 처방하지 않음. 검토된 방법에만 제품 적용 관계 부여 |
| 학습/TTS | `lib/workspace/tts-controller.ts`, `lib/echo/tts-player.ts` | 연구 원문을 TTS/학습 콘텐츠로 복제하지 않음 |
| 디자인 | `DESIGN.md`, `vocaflow-design`, `vocaflow-design-loop`, `docs/DESIGN_SYSTEM.md` | 주묵/근거 연결·점진 공개. 4안 사람 선택 이후 화면 구현 |

## 데이터 계약

전문가 → 공개 활동 근거 → 채널의 소유 관계 → 콘텐츠 → 위치 지정 근거 → 주장 → 정규 방법론.
분류는 학령/숙련도/시험/기능/과정/문제유형을 분리한다. 초등=낮은 CEFR로 환산하지 않는다.
초등과 성인 회화도 조사하지만 제품의 현재 핵심 대상(고등학생~성인)과 구별한다.

- 콘텐츠의 `indexed`는 방법론 추출 완료가 아니다. 접근 실패, 권리 미확인, 분석 대기를 구분한다.
- 방법론의 원칙·조건·절차·이유·예시·실패·예외·전이는 **각각 주장**이다. 출처 없는 항목은 비운다.
- 출처 내용에 명시된 주장과 분석자의 추론을 구별한다. 추론을 전문가의 말로 귀속하지 않는다.
- 정확한 위치는 영상 초 구간 또는 문서 섹션. 제목·챕터 이름은 실질적 방법론의 증거가 아니다.
- 짧은 인용은 허용 근거가 확인된 경우만. 기본은 재서술 및 출처 링크. 전체 자막은 영구 모델에서 제외한다.
- 동일 강사의 재업로드/쇼츠는 같은 `originGroup`으로 묶어 독립 근거 수를 부풀리지 않는다.
- 다수의 동의는 교육 효과 검증과 별개. 효과 강도는 연구 설계가 확인된 별도 근거 없으면 `not_assessed`.
- 표현 유사도는 중복 **후보**를 만들 뿐 자동 병합하지 않는다. 조건이 다르면 합치지 않는다.
- 반대·조건 차이·상보적 방법을 관계와 이유로 남긴다. 연구 공백과 미확인은 0/부재와 구분한다.

## 완료 기준과 단계

1. 분야별 후보·일차 출처·조사 공백을 기록하고 실측 taxonomy와 연결한다.
2. 주장 없는 영상 목록에서 방법론이 만들어지지 않는 검증기 및 회귀 테스트를 먼저 만든다.
3. 허용된 자막을 의미 구간으로 나눠 드레인하고 해시/버전/위치로 검증한다.
4. 정규화·비교·커버리지 집계가 실제 provenance를 유지하는지 검사한다.
5. DB DDL은 검토 가능한 SQL로 제출한다. 승인 전 원격 스키마/데이터 변경 없음.
6. [화면 4안](../design/compare/methodology.md) 선택 후 기존 Admin 인증·도움말에 연결한다.
7. UI는 모바일/데스크톱·다크·키보드·실근거 이동·빈/실패 상태를 렌더 검증한다.

현재 문서는 조사 결과이며 구축 완료나 배포를 의미하지 않는다.
