# 다섯 역할의 거부 시나리오 기술 검사

실제 다섯 명의 참여가 아닌 에이전트의 관점별 기술 검사다. 사람이 이해했는지·교사/강사가 동의했는지는 NOT_OBSERVED/NOT_VERIFIED다. 이 검사는 새 네 후보의 교육 효과를 비교한 실험이 아니다.

| 관점 | 실제 문항·상태 | 수행한 검사·증거 | 결과와 한계 |
|---|---|---|---|
| A 초보 | 34,1440,READ 강의 | 실제 컴포넌트 캡처에서12cue DOM 로드·다수 대본 동시 노출, 이미지 직접 관찰 | 기본 과밀 완화 계약에 반례. 초보 학습자 부담 측정은 아님 |
| B 숙련 | 34 재생 liveScene | AnalysisTheater.tsx:846~852 selectScene 호출과 LectureStage scrollIntoView 정적 추적 | FAIL_CONTROL; 실제 포커스 강탈/사용자 시간은 미측정 |
| C 교사 | 34②/22③/38위치 | 실제 분석 구조 unknown/fails,true/fails,n_a를 대조, 1280의38 판단 화면 직접 관찰 | 구조 구분 확인. 원문/선지 전문의 내용 감수 미실시 |
| D 강사 | 34c1/c4/c12,22c13,38c1/c12 |37원본을 읽고 지정6차례의 한정 생략·일반화·정답 암시 위험을 원문 부분근거와 대조 | 수정 CANDIDATE만 기록. 강사 승인·전체 내용 확정 아님 |
| E 평가/품질 | 34 익명 실제 route + pairs0 |1280/1440 GET은 login?next=/csat/item/2026-34로 이동,itemVisible0. pairs=[] 대조 | 익명 로그인 gate 관찰 PASS. 정상 계정RLS/완료 후 숙달 상태 미검증 |

[브라우저 기록](./evidence/browser-results.json)의 sourceCommit이 실제 main-serving 3f437e9b6와 일치한다. 캡처에 보이는 원문 부재 안내를 제품 자체의 결함이나 원문을 확보한 정상 학생의 화면으로 보고하지 않는다.
