# S0 공백·미확인·실제 차단 기록

측정: 2026-10-23T12:08:29.06415+00:00 / 기준 소스: `3f437e9b65e06c00a96f64890402500417377c92` / AI-Control: T-0131의 보완 실사.

원문·선지 전문·개인 학습기록은 저장하지 않았다. DB 관리자 SELECT의 관측이며 계정별 접근 가능성은 별도다. 분류의 내용 타당성·전체 기출의 완전성·학생 효과를 입증하지 않는다.

| ID | 사실/공백 | 상태 | 영향/다음 검증 |
| --- | --- | --- | --- |
| G01 | DB3714 중 type_id NULL16, 분류 내용 전량 감수 안 함 | UNMAPPED / NOT_EVALUATED | 등록부 ID 보존, 원문/발문 실제 대조 뒤 분류 후보 검토 |
| G02 | DB 듣기0, 로컬 수능 듣기248·18유형 존재 | PARTIAL / DATA_GAP | 모평·학평 및 원음/전사/화자/시간·권리 범위 UNKNOWN |
| G03 | 공개 판 없음302=최신 in_review183+분석 없음119 | DATA_GAP | 이전 공개판이 제공되는186개라는 해석 금지(실제3개) |
| G04 | 평가원 구식3persona pass802; 학평 새 검수/units 결속 전수 함수 timeout | UNKNOWN / QUERY_BLOCKED | 현재 정합 프로토콜 판정은 미검증. 구조/기록 존재만 accepted로 승격 금지 |
| G05 | 최신 units 행 hash 차이는 current input_hash 일치 여부와 별개 | UNKNOWN | mismatch 후보만 보존; 앵커를 무조건 유효/무효로 확정하지 않음 |
| G06 | meaning sidecar27은 실제 schema/review hash/결속 통과 | METADATA_READY | 사람 감수/원문 정확성/학습 효과와 별도 |
| G07 | 로컬 PDF 원문/전체 영문 선지·정답표 1:1 대조 미실시 | UNVERIFIED | 공식 출처와 대조 전 저장 정답 정보로 취급 |
| G08 | 저작권 경계 통합 테스트 로그인 Invalid login credentials | AUTH_BLOCKED | 두 실DB suite 초기화 실패. 실제 계정 RLS PASS 불가. 비밀번호 변경·우회 없음 |
| G09 | TTS 실제 음성·발음·구간/실패 동작 미실시 | NOT_EVALUATED | 평가 원음 대체 금지; 강의 추정 시간과 실제 청취 구분 |
| G10 | compare-v3 서버 공개/결속 projection 존재 | PARTIAL / runtime UNVERIFIED | 비공개 콘텐츠 전송 없음은 정상 계정 응답으로 추가 확인 |
| G11 | teaching-contract 26개 교수 모델 존재, CHART_CELL 개념 단위 있음 | PARTIAL | 실제 셀 값/좌표·수치 검증 어댑터는 자료/컴포넌트 실사 추가 |
| G12 | 현재 lecture liveScene 자동 selectScene 존재 | CORE-03/09 충돌 | S1에서 학생 통제·상태 유지 검증 |
| G13 | source registry license는 시험/원음 개별 배포권 증빙 아님 | UNKNOWN | 해당 원본과 권리·계정 접근을 별도 결속 |
| G14 | 134회 listening_end 합2288, 선언 item_count 합5982 | METADATA_ONLY | 선언합-저장합2268은2288과20차이. 134×17로 결손을 확정하지 않음 |
| G15 | 기준서 외부 Downloads 파일 및 이전 캡처는 별도 입력 | PROVENANCE | 입력 SHA와 소스 SHA를 고정; 구 캡처로 현재 화면 동일성 단정 없음 |
| G16 | 모든 실제 시험 유형의 완전 수집/분류 공식 승인 미확보 | UNKNOWN | 44유형은 관측 합집합이며 공인 완전 분류로 주장하지 않음 |
| G17 | 학생 사용성·전이·성적 실험 미실시 | G3/G4 NOT_EVALUATED | S0 PASS 범위는 등록부/공백 보고/계약 충돌 식별까지 |

원칙: 원문·강의 원본·DB·시드는 변경하지 않았다. 상태 부재를 ready/accepted/allowed로 채우지 않는다. 필수 퀴즈·자유서술 채점·개인 임의 자료 평가·클릭 숙달 산입은 제안하지 않는다.
