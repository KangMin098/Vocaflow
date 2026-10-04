# FYM 검토 구절의 보존 규칙과 각색 예시

2026-10-04. [1차 정밀 검토](./frym-precision-20261004.md)의 후보 F02/F06/F14/F18을 대상으로 보존 규칙 4개를 추출하고, 중1/고1 목표 각색 8편을 작성해 관찰 검토했다. source/review/research 해시·revision·정렬 ID·짧은 증거에 묶인 생성 계약으로 연결했다. DB 쓰기·발행·마이그레이션은 0이다.

## 보존 조건

| 쌍 | 범위와 보존 조건 | 허용한 변경 |
|---|---|---|
| F02-A1 | 시각/촉각은 기능이 다르며 절대적 우열을 확정하지 않음 | 몸의 위치·찾기·잡기 예시, 문장 분해, 기능부터 설명 |
| F06-A1 | 서식처 제공·다양성의 가능한 기능, 원 리뷰의 Global North 범위 | habitat/biodiversity 설명, 관련 없는 건강 효과 제외, 원 연구의 생략된 범위 복원 |
| F14-A1 | 입원/ICU와 보고 증상의 강한 연관; 집단 비교·증상·관찰적 한정·유럽 범위 | ICU 설명, 수치/모형 세부 압축. 개인별 시간 변화/확정 진단/인과 또는 사망군보다 ICU가 높다는 순위는 만들지 않음 |
| F18-A1 | 8종의 난소소관 수와 headbutting의 양의 상관; 종 평균·인과 미확정 | 구조/상관 설명, 통계 세부 압축. 모든 개체·AI 성능·인과로 확대하지 않음 |

이 조건은 기사 전체의 정확성이나 전문가 gold를 인증하지 않는다. 연령별 변환의 효능을 확정한 규칙도 아니다. FYM의 실제 저자가 생략한 범위/한계를 일부 복원하므로 FYM 문장을 모범 답안으로 그대로 복제하지 않았다. 원 연구/각색문 권리 검사는 정렬·보존 규칙과 별도로 유지한다.

## 8편 로컬 예시

같은 language_band=middle, passage_v_level=3 목표에 age_band/reasoning_band와 목표 skills를 중1/고1 설정으로 바꿨다. 중1 대표 질문은 R4 중심내용, 고1은 R8 근거의 한계를 다룬다. 원 target의 모든 skill에 대한 문항 세트는 아니다. V3는 요청값이며 실제 VRL 분석/학습자 수행 측정은 하지 않았다.

| 쌍 | 중1 단어 수 | 고1 단어 수 | 기록 구절의 관찰 검토 |
|---|---:|---:|---|
| F02 | 196 | 196 | 기능 차이·절대 순위 한정 보존 |
| F06 | 195 | 202 | 가능성·리뷰 범위 보존 |
| F14 | 206 | 203 | 집단 비교·증상·비인과·유럽 범위 보존 |
| F18 | 198 | 209 | 종 간 양의 상관·개체/인과 한정 보존 |

원천: Hutmacher, [What Is Our Most Important Sense?](https://kids.frontiersin.org/articles/10.3389/frym.2021.548120/full); Orsini and D’Ostuni, [The Important Roles of Urban Agriculture](https://kids.frontiersin.org/articles/10.3389/frym.2022.701688/full); Lovik et al., [Studying the Mental Health of Family and Friends of COVID-19 Patients](https://kids.frontiersin.org/articles/10.3389/frym.2026.1598115/full); Gleason and Bath, [Using AI to Study Fighting in Female Fruit Flies](https://kids.frontiersin.org/articles/10.3389/frym.2026.1635652/full). 보존 FYM HTML의 기사별 저작권자·[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 표시를 읽고 각 예시에 출처/권리자/라이선스/변경 설명을 기록했다. 원 연구 DOI는 각 예시와 규칙에 별도로 남겼다. 이미지는 복제하지 않았다.

에이전트가 작성 후 직접 읽어 판단했고, 독립 에이전트가 기존 연구 구간과 대조했다. 교차 리뷰에서 대표 질문 3건의 근거가 답을 직접 지지하지 않은 결함을 수정했다. F09 부정 예시의 대상 명칭도 urban nature sites로 수정해 분모 오류만 예시하도록 했다. 관찰 판정 8건 모두 preserved지만 통계적 생성 정확도, 전문가 인증, 학생 calibration으로 해석하지 않는다. 같은 작성자의 self-report만으로 의미를 자동 인증하지 않는다.

## 생성 계약과 실조회

규칙 사용은 명시적 선택이다. export와 import에 `--preservation-rules`/`--precision-review`를 함께 전달하고 정렬 verdict/full_text·회차 SHA·source UUID/key/URL/hash/revision·연구 DOI/hash·짧은 anchor를 대조한다. 규칙의 조건 텍스트까지 rules_hash에 묶는다. 결과는 각 규칙의 실제 passage_quote·verdict·reason을 기록한다. 누락·중복·모르는 ID·changed/held·없는 quote는 거절한다. import 초기와 각 DB insert 직전 최신 파일을 다시 읽으며, 최신 파일을 주지 않거나 수정된 review/rules는 옛 청크와 일치하지 않는다. 폐기된 회차를 다시 지정해 사용하는 것을 자동 탐지하는 중앙 revocation 레지스트리는 없으므로 정정 회차와 새 export를 사용해야 한다.

원천 SELECT 두 곳이 source_id를 누락한 결함은 공통 조회 컬럼으로 수정하고 조회 투영→실제 draft 검증 회귀를 추가했다. 실제 DB의 후보 4행은 모두 queued·article_v_level=null·word_count=null이며 cc_by/display_only=false/copyright_safe_in_kr=true였다. 기존 gte(0)가 null을 제외해 export가 0행을 만들었다. 검토 목록 UUID에 한해 미측정을 그대로 허용하고 다른 원천 필터를 유지했으며 재실행 후 4행·1청크를 읽기 전용으로 생성했다. 원문에 V0을 기록하거나 기존 행을 갱신하지 않았다.

구조 검사는 거짓 preserved 판정과 실제로 존재하는 인용이 함께 들어온 의미 오류를 탐지하지 못한다. 해당 한계를 회귀 테스트로 명시했으며 새 각색의 상태는 여전히 awaiting_content_review다. 로컬 pilot에는 full reading_analysis/기사별 source_rights가 없으므로 importer용 완성 청크가 아니다.

## 실패 예시와 재현

원 회차의 F05-A1 비교 방향, F09-A1 방문자 421명/전체 458명 분모, F10-A2 빈도 감소를 변화 없음으로 바꾸기, F13-A2 과제 9세/후속 측정 13세를 혼동하기를 부정 예시로 남겼다. 이 판정은 관찰자가 연구를 읽고 내린 것이며 자동 의미 분류 성공률이 아니다.

[규칙 JSON](../../scripts/textbook/frym-precision/preservation-rules-1.json) · [예시 JSON](../../scripts/textbook/frym-precision/adaptation-pilot-1.json) · [명령/복구](../../scripts/textbook/frym-precision/README.md). 원본 스냅샷은 ignored .agent-logs/frym-precision-r2에 있다. verify를 반복해도 파일과 DB가 변하지 않는다. 다른 체크아웃에서 정확한 증거 대조를 재현하려면 보존 스냅샷이 필요하다.

검증: library-pipeline 테스트 2,810개·타입 검사, Admin 도움말 53개·해당 파일 ESLint, 원본 precision/pilot verify와 7가지 변조 거절(본문 변경·규칙 누락·changed·held·없는 인용·회차 해시 변경·목표 중복)을 통과했다. 교차 리뷰의 source_id 조회 누락·질문 근거·부정 예시 대상 명칭 지적을 반영했다. SHA로 묶인 JSON은 Git 줄끝 정규화에서 제외해 다른 PC 체크아웃에서도 바이트를 보존한다.
