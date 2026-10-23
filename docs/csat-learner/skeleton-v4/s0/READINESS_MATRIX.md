# S0 자원 준비도·검수·공개 독립 상태

측정: 2026-10-23T12:08:29.06415+00:00 / 기준 소스: `3f437e9b65e06c00a96f64890402500417377c92` / AI-Control: T-0131의 보완 실사.

원문·선지 전문·개인 학습기록은 저장하지 않았다. DB 관리자 SELECT의 관측이며 계정별 접근 가능성은 별도다. 분류의 내용 타당성·전체 기출의 완전성·학생 효과를 입증하지 않는다.

`readiness=ready|missing|stale|mismatch|unknown`, review, 저장 publication, 계정 permission을 따로 기록한다. ready는 **메타데이터/결속 검사에서 사용할 자료가 존재**한다는 뜻이다. 원문·선지는 관리자 저장 여부와 학습자의 로컬 추출 상태를 구분한다. permission은 모두 unknown이며 정상 로그인 통과로 바꾸지 않았다.

의미 지원 27개의 로더 통과는 `SCHEMA_VERIFIED`(schema·검수 본문 해시·base 결속)의 범위다. `CONTENT_VALIDATED`, 교사·강사의 내용 감수, 정상 계정 접근, 실제 학습 효과는 별도로 미검증이다. 이 S0 수치나 코드 존재만으로 기능의 재사용을 결정하지 않는다.

| 자원 | 전체 3,714 상태 | 공개 카탈로그 3,412 상태 | 검수/공개 해석 |
| --- | --- | --- | --- |
| 해설 | ready:3412 · missing:302 · stale:0 · mismatch:0 · unknown:0 | ready:3412 · missing:0 · stale:0 · mismatch:0 · unknown:0 | published 3,412. 평가원 구식 3인 pass 802; 학평 현재 독립 프로토콜 유효성 전수 판정은 UNKNOWN |
| 탐구 v3 | ready:786 · missing:2928 · stale:0 · mismatch:0 · unknown:0 | ready:786 · missing:2626 · stale:0 · mismatch:0 · unknown:0 | 검수 표시/정확성/실제 접근은 별도 |
| 상세 의미 | ready:27 · missing:3687 · stale:0 · mismatch:0 · unknown:0 | ready:27 · missing:3385 · stale:0 · mismatch:0 · unknown:0 | 27개는 schema/criteria/contentHash/basePublicHash/version 검사를 통과. 전량 내용 정확성/원문 대조는 별도 |
| 학습자 원문 | ready:0 · missing:0 · stale:0 · mismatch:0 · unknown:3714 | ready:0 · missing:0 · stale:0 · mismatch:0 · unknown:3412 | 검수 표시/정확성/실제 접근은 별도 |
| 학습자 선지 | ready:0 · missing:0 · stale:0 · mismatch:0 · unknown:3714 | ready:0 · missing:0 · stale:0 · mismatch:0 · unknown:3412 | 검수 표시/정확성/실제 접근은 별도 |
| 강의 | ready:796 · missing:2918 · stale:0 · mismatch:0 · unknown:0 | ready:796 · missing:2616 · stale:0 · mismatch:0 · unknown:0 | 796개 저장 대본. rubric_score는 독립 내용 감수나 TTS 검증이 아님 |
| 비교(공개 전) | ready:477 · missing:3237 · stale:0 · mismatch:0 · unknown:0 | ready:477 · missing:2935 · stale:0 · mismatch:0 · unknown:0 | 477개 연결 문항. 서버 projection은 공개·결속을 검사하며 실제 계정 permission은 미검증 |
| 골격 | ready:3101 · missing:613 · stale:0 · mismatch:0 · unknown:0 | ready:3101 · missing:311 · stale:0 · mismatch:0 · unknown:0 | 파일 골격 802 + DB 골격 메타. DB 행을 학습자 캐시에 주입하지 않음 |
| PDF 좌표 색인 | ready:802 · missing:2912 · stale:0 · mismatch:0 · unknown:0 | ready:802 · missing:2610 · stale:0 · mismatch:0 · unknown:0 | 좌표 색인 존재는 로컬 PDF matched가 아님 |

## 유형별 준비 수(ready만, 각 결손/미확인은 ITEM_METADATA에 전수 기록)

| type | 문항 | 해설 | v3 | 의미 | 강의 | 비교 | 골격 | 원문/선지 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-BLANK | 527 | 421 | 115 | 4 | 115 | 92 | 288 | unknown |
| R-BLANK2 | 4 | 4 | 2 | 0 | 4 | 2 | 4 | unknown |
| R-CHART | 133 | 30 | 29 | 1 | 29 | 0 | 29 | unknown |
| R-CLAIM | 127 | 52 | 25 | 1 | 23 | 23 | 49 | unknown |
| R-FACT | 131 | 131 | 28 | 1 | 28 | 0 | 126 | unknown |
| R-GIST | 132 | 132 | 27 | 1 | 29 | 24 | 131 | unknown |
| R-GRAMMAR | 129 | 129 | 29 | 1 | 28 | 0 | 129 | unknown |
| R-IMPLY | 115 | 115 | 22 | 1 | 22 | 19 | 115 | unknown |
| R-INSERT | 262 | 262 | 55 | 2 | 56 | 41 | 261 | unknown |
| R-IRRELEVANT | 132 | 132 | 28 | 1 | 28 | 26 | 132 | unknown |
| R-MOOD | 132 | 132 | 21 | 0 | 28 | 20 | 131 | unknown |
| R-NOTICE | 265 | 265 | 57 | 2 | 57 | 21 | 244 | unknown |
| R-ORDER | 262 | 262 | 56 | 2 | 55 | 33 | 256 | unknown |
| R-PURPOSE | 131 | 131 | 26 | 1 | 27 | 26 | 125 | unknown |
| R-REFER | 18 | 18 | 6 | 0 | 6 | 0 | 17 | unknown |
| R-SUMMARY | 130 | 130 | 28 | 1 | 28 | 28 | 29 | unknown |
| R-TITLE | 137 | 137 | 31 | 1 | 31 | 31 | 134 | unknown |
| R-TOPIC | 134 | 134 | 30 | 1 | 29 | 27 | 132 | unknown |
| R-VOCAB | 132 | 132 | 28 | 1 | 29 | 2 | 124 | unknown |
| X-BLANK | 17 | 17 | 6 | 0 | 6 | 6 | 14 | unknown |
| X-BLANK2 | 1 | 1 | 1 | 0 | 1 | 0 | 1 | unknown |
| X-FACT | 133 | 133 | 29 | 1 | 29 | 0 | 133 | unknown |
| X-ORDER | 133 | 133 | 29 | 1 | 29 | 29 | 133 | unknown |
| X-REFER | 133 | 133 | 27 | 1 | 29 | 0 | 133 | unknown |
| X-TITLE | 133 | 133 | 29 | 1 | 28 | 27 | 124 | unknown |
| X-VOCAB | 115 | 113 | 22 | 1 | 22 | 0 | 107 | unknown |

## 최신 판과 공개 판

최신 상태 in_review는 186개다. **183개는 공개 판이 없고**, 이전 published 판이 있는 것은 **3개**: H2103G2#28(공개 v2/최신 v3), H2104G3#28(공개 v2/최신 v3), H2410G2#41(공개 v2/최신 v3). 새 draft/in_review가 있다는 이유만으로 현재 published에 결속된 v3를 stale로 재분류하지 않는다. stale은 각 로더의 실제 분석 version/hash 불일치로 정한다.

최신 units_version 행과 공개 해설 units_hash가 다른 후보는 27개다. 그러나 latest version과 현재 input_hash에 맞는 유효 단위는 같다고 보장할 수 없다. 전수 현재 독립 검수 함수 호출은 statement timeout으로 실패했으므로 **후보/UNKNOWN**, 실제 mismatch 확정으로 바꾸지 않는다.

## 원문·선지·권리와 공개

관리자 DB passage/choices는 학습자 제공 자료가 아니다. ReflowItem은 브라우저 로컬 stem/passage/choices/inline/needsOriginal, CachedPaper는 exam_id/sha256/version/items를 갖는다. 도표·밑줄은 원본 크롭 확인이 필요할 수 있다. PDF 미투입은 pdfMatch=unverified다. 유형이 inline이면 choices 빈 배열도 정상일 수 있어 5개 미만을 곧 파서 오류로 확정하지 않는다.

라이브 카탈로그 뷰는 발문·본문·선지에 대한 authenticated column ACL을 제한하고 answer는 embargo 함수로 마스킹한다. base table RLS와 앱 서버 검증도 존재한다. 이 정적/관리자 관측은 정상 계정의 실제 허용을 증명하지 않는다. `source_registry.license_class`는 수집 원천 코퍼스의 필드이며 각 시험 PDF/평가 원음의 재배포 권리가 확인됐다는 뜻이 아니다.

듣기 로컬 248개는 해설/v3/의미/강의/비교·평가 원음·검수된 전사·화자·시간 구간을 이번 범위에서 결속하지 못했다. 각 자원 UNKNOWN/DATA_GAP이며 DB의 3,714 분모에는 섞지 않는다.
