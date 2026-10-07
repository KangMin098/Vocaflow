# 시중 교재 benchmark 출처 대조: 잠정 목록

기존 31행(고유 SHA-256 30개)의 원본을 다시 해시 확인하고, 파일명에 대응할 *가능성이 있는* 출판사 공식 서지 페이지를 대조했다. 결과는 저장소 밖 `D:\workspace\Vocaflow-benchmark-audit-20261008\source-review-r3b.json`에 파일별로 기록했다(SHA-256 `6a2b345ecd436941220f666f7dfba63fe79ba6cc32909b8847498e7fdc080ba6`). 앞서 만든 `source-review-r3.json`은 복수 학년 자체를 보류 사유로 오인한 탐색본으로 보존하며 판정 입력에서 제외한다. 이 목록은 `BENCHMARK_SELECTION_PROTOCOL`이나 `BENCHMARK_SAMPLE_MANIFEST`의 새 봉인본이 아니다. 기존 봉인본과 screening revision 2는 그대로 둔다.

| 관찰 | 결과 |
|---|---:|
| 원본 SHA-256 재확인 | 31/31 |
| 고유 파일 | 30 |
| 공식 서지 후보 URL 연결 | 26행 (중복 파일 1행 포함) |
| 분석 권한 확인 | 0 |
| 로컬 파일과 정확한 ISBN/판본 결속 | 0 |
| 학년 범위·지문/문항 경계까지 모두 확인 | 0 |
| metadata eligible / selected passage / corpus | 0 / 0 / 0 |

공식 서지와 로컬 파일 사이의 연결은 아직 **제목·시리즈 기반 후보**다. 공식 웹페이지에 책의 ISBN이 있어도 로컬 파일의 표지·판권 또는 원본 다운로드 출처가 같은 판본임을 입증하지는 않는다. 공식 미리보기나 정답 파일이 공개되어 있다는 사실도 현재 파이프라인의 `authorized_local_analysis` 권한 증거로 자동 변환하지 않는다. 따라서 네 조건 `rights_verified`, `edition_verified`, `grade_scope_verified`, `boundary_verified`는 모든 파일에서 `false`이고 `hold`를 유지한다.

학년 라벨은 **단일 학년과 복수 학년 모두 유효한 교재 생성 타겟**으로 기록해야 한다. [리딩튜터 주니어 2 (2024)](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000130)는 공식 서지상 중1, [수능 딥독 LEVEL 3](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000141)은 중3이다. [수능 딥독 LEVEL 1](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000140)은 중1~중2, [LEVEL 2](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000139)는 중2~중3으로 표기된다. [달곰한 Literacy Reading LEVEL 2](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000134)·[LEVEL 3](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000135)는 초3~초4, [LEVEL 4](https://m.nebooks.co.kr/pages/book/view.asp?c=BB07000136&ct=BB07)·[LEVEL 6](https://m.nebooks.co.kr/pages/book/view.asp?c=BB07000138&ct=BB07)는 초5~초6이다. 복수 학년은 탈락 사유가 아니다. 현재 봉인된 `single_grade_only` benchmark 계약이 이 범위를 아직 표현하지 못하는 **구현 미비**다. 복수 학년 표본을 특정 한 학년 분포에 임의로 중복 계수하지 않도록, 새 계약에서 `grade_scope=single|range`와 대상 학년 집합을 보존하고 범위별 비교·생성 판정을 따로 정의해야 한다.

파일별 잠정 서지 링크는 ledger에 남겼다. NE의 [빠른독해 바른독해 구문독해](https://www.nebooks.co.kr/pages/book/view.asp?c=BD02040002), [유형독해](https://www.nebooks.co.kr/pages/book/view.asp?c=BD02000073), [리딩튜터 수능 PLUS](https://www.nebooks.co.kr/pages/book/view.asp?c=BD02000026), [Reading Inside Level 2](https://m.nebooks.co.kr/pages/book/view.asp?c=BB07000126), 쎄듀의 [첫단추 독해유형편](https://www.cedubook.com/products/2505270001)과 [천일문 독해 BASIC A](https://cedubook.com/products/2408210001)도 판본 확인에 사용할 후보 URL이다. 숫자형 파일명, 이름이 불명확한 복사본, 두 ZIP, 단어 목록은 파일 단위의 공식 서지 연결도 보류했다. ZIP 내부 구성원은 별도 원본 해시와 권리 증거 없이 개별 교재 표본으로 다루지 않는다.

다음 screening revision과 manifest 봉인은 **학년 범위를 지원하는 새 계약과 현재 코드가 검증 가능한 파일별 증거 입력**이 생긴 후에 만든다. 지금의 `real-intake-screen.mjs`는 확인된 권리·판본·학년·경계를 가진 파일을 아직 후보 passage로 변환하지 않고, `real-intake-seal.mjs`의 revision 2 범위도 unreviewed hints와 후보 0건에 묶여 있다. 또한 `Product Order`의 `grade_target`과 `target.age_band`는 단일 학년 값 하나만 받으므로, 복수 학년 교재를 **한 주문의 범위**로 표현하고 단원·권까지 동일 계보로 조립하는 기능은 아직 없다. 별도의 학년별 주문을 만들 수 있다는 사실을 복수 학년 교재 생성 완료로 간주하지 않는다. 이 계약을 우회해 `hold`만 복제한 revision 3을 봉인하지 않는다. 우선순위는 (1) 단일·복수 학년 모두의 Product Order 및 benchmark 학년 범위 계약, (2) 각 파일의 입수·분석 권한, (3) 파일 내부 판권 또는 출판사 원본 URL로 정확한 판본 결속, (4) 지문·문항의 실제 페이지 경계 육안 확인, (5) 그 근거를 받는 새 screening 계약과 독립 verifier다.

실제 9축 분포 0, Gold-S 0, DB seed 0, Phase 3 운영 E2E 대기 상태는 변하지 않았다.
