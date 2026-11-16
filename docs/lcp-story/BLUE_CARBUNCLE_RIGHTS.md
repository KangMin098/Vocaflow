<!-- docs/lcp-story/BLUE_CARBUNCLE_RIGHTS.md -->
# S7 대표 Story 권리 결정 자료 — Blue Carbuncle

작성: 2026-10-26, 결정 자료 v2. 상태: **공개 근거 수집·원문 결속 확인 완료 / 사람의 개별 권리 결정 미수신 / DB 권리 미기록 / 미발행**.
AI 자료 조사이며 법적 적법성이나 사람 승인이 자동 확정된 문서가 아니다. 실제 권리 결정은 아래 대상과 범위에 한정해 별도로 기록한다.

## 1. 정확한 대상과 사용 범위

- Arthur Conan Doyle, *The Adventure of the Blue Carbuncle* 영어 원작을 바탕으로 한 기존 `story-b2` 판본. 기존 제작·검수·16단위를 유지한다.
- 확인 대상 권리는 dev 프로젝트의 기존 Story 서비스에 사용할 **이 고정 원천의 영어 원작 및 SE 텍스트 기여분(`source_text`)**이다. 아래 기존 각색 판본은 결속 대조의 참고 대상이다. B2/V7–8은 편집 목표이며 학습자 수준이나 CEFR 실측 결과가 아니다.
- **기존 DB 결정은 source_id의 자산 단위로 작용한다.** 같은 원천을 쓰는 `easy-b1` 자리와 향후 판본도 이 최신 `source_text` 결정을 참조할 수 있다. 특정 각색판만의 허가로 제한되는 DB 필드는 없다. 다른 판본의 품질·검수·witness·발행을 자동 승인하는 결정은 아니다.
- 번역본을 가져오지 않았다(`translator=null`, 원문·본문 언어 `en`). 판본 `assets=[]`: 원본 표지·삽화·오디오·폰트·로고를 포함하지 않는다. SE의 보증이나 제휴를 표시하지 않는다.
- 한국 서비스 이용을 중심으로 원저작물 보호기간과 출처 기여분을 검토했다. 아래 미국·영국 자료는 보조 근거이며 전 세계 모든 권리의 일괄 확인을 뜻하지 않는다.

| 결속 항목 | 값 |
|---|---|
| source ID | `cfaff6fd-0bc1-4e4a-85e3-8332be4d2289` |
| slot ID | `e261eac4-37d1-4dd1-8c8d-1eca5cea2ead` |
| edition version ID | `95b0f75b-eac5-4c1e-ac2e-436f6676621a` |
| 고정 SE revision | `60f53b2fc44178af326d56f45a5b6d02a8badd68` |
| source identity SHA-256 | `63b8416a8aec8ca90cead780b811a78fab57700d0f80a4b5f2d49f093ed8be33` |
| source text SHA-256 | `391413941cedf99977ff340a1f5b49476222c38facd578b0afe2884bb570a129` |
| edition 파일 SHA-256 | `a94d9c5f370054e7f72ea01480c013b808499a785735ba10e539e34c11d805a7` |
| edition canonical SHA-256 | `2faeaa696d5638331f01d291323a8c899f51f20a378640c900072aa40f19d414` |
| 기존 독립 AI review 파일 SHA-256 | `0b5813da9d39b7aad0ac2789753c21e5a33144ec23d461ec18636df122e43b7e` |

## 2. 원작·판본·자산별 근거

| 구분 | 확인한 자료와 사실 | 판단 범위·남은 한계 |
|---|---|---|
| 원작 저자 | [미국 의회도서관 전거](https://id.loc.gov/authorities/names/n79082292.madsrdf_raw.json): Doyle 사망일 `1930-07-07` | 식별 가능한 저자의 영어 문학 저작물에 관한 기간 계산이다. |
| 원작 발표·출처 | [1892년 1월 Strand No.13 아카이브 메타데이터](https://archive.org/metadata/StrandMagazine13), [고정 판본 colophon](https://raw.githubusercontent.com/standardebooks/arthur-conan-doyle_the-adventures-of-sherlock-holmes/60f53b2fc44178af326d56f45a5b6d02a8badd68/src/epub/text/colophon.xhtml): 1892년 작품, PG #1661 및 1892년 스캔을 기초로 한 SE 제작 경위 | 이번에 아카이브 스캔 전체를 육안 교감한 것은 아니다. 실제 사용 본문은 아래 고정 XHTML과 직접 대조했다. |
| 한국 원저작물 보호기간 | [저작권법 제39조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0039&lsiSeq=283335&urlMode=lsScJoRltInfoR)의 사후70년과 [제44조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0044&lsiSeq=283335&urlMode=lsScJoRltInfoR)의 다음 해 기산 | **추론:** 1930년 사망에 현행70년을 보수적으로 적용해도 2000년 말까지다. 과거 개정·경과규정에 따른 최초 만료일을 확정한 주장은 아니다. 별도 현대 번역·삽화 권리를 이 계산에 포함하지 않는다. |
| 영국 원저작물 보호기간 | [CDPA 1988 section12](https://www.legislation.gov.uk/ukpga/1988/48/section/12/data.xml)의 사후70년·달력연도 말 계산 | **추론:** 같은 보수적 계산상 2000년 말까지다. 과거 권리 회복과 최초 만료 연혁 전체를 판정한 것은 아니다. |
| 미국 원저작물 보호기간 | [미국 저작권법 chapter3 §304](https://www.copyright.gov/title17/92chap3.html)의 구 저작물95년 기간과 SE의 미국 PD 설명 | **추론:** 1892년 발표물에95년 상한을 가정해도 1987년 말까지다. 해당 작품에 실제95년 갱신기간이 부여됐다는 뜻이나 최초 만료일 확정은 아니다. |
| SE 판본 기여분 | [고정 revision LICENSE](https://raw.githubusercontent.com/standardebooks/arthur-conan-doyle_the-adventures-of-sherlock-holmes/60f53b2fc44178af326d56f45a5b6d02a8badd68/LICENSE.md)는 기반 텍스트·그림에 관한 **미국 PD 주장**과 SE 제작자·기여자의 **세계적 CC0 헌정**을 구분한다. | 기반 원작의 한국 권리는 앞의 별도 기간 근거로 판단한다. CC0를 다른 권리자의 현대 번역·그림까지 확대하지 않는다. |
| CC0 조건 | [CC0 1.0 법률문](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) | 상표·보증·제휴 권한을 얻었다고 표시하지 않는다. 출처·원작·각색 표시는 유지한다. |
| 실제 사용 본문 | [고정 XHTML](https://raw.githubusercontent.com/standardebooks/arthur-conan-doyle_the-adventures-of-sherlock-holmes/60f53b2fc44178af326d56f45a5b6d02a8badd68/src/epub/text/the-adventure-of-the-blue-carbuncle.xhtml)에서 기존 추출 규칙으로 문단을 정규화해 snapshot과 비교 | **214/214 문단 동일, 차이0, 정규화 본문 SHA 동일.** 원문 snapshot의 권리 주장을 임의 수정하거나 identity를 바꾸지 않았다. |
| Vocaflow 각색·활동 | 기존 Claude 제작과 별도 Codex 세션의 실질 AI 검수. 원문 대응·변경 근거·16단위·활동을 기존 산출물에 보존 | 외부 현대 번역을 가져온 것으로 처리하지 않는다. AI 산출물의 독점 저작권이나 실제 사람 콘텐츠 검수 완료를 주장하지 않는다. 실제 학습 효과는 미검증이다. |
| 번역·표지·삽화·음원·폰트 | 이번 판본에 외부 자산 사용 없음 | 해당 자산을 나중에 추가하려면 그때 각각 권리와 정합성을 확인한다. 이번 결정의 범위 밖이다. |

원작에는 거위 도살·동물 위해와 시대적 표현이 있다. 새 독립 콘텐츠 검수에서 기존 정책의 “직접적인 폭력 장면은 없다”는 설명이 해당 본문과 맞지 않는 결함을 발견했다. 기존 Claude 제작 세션에서 정책·안내만 최소 보완 중이며, 고친 판본은 별도로 검수한다. 이 원천 권리 자료가 해당 결함이나 판본 발행 조건을 충족시키지는 않는다. 모든 연령·수준에 적합하다고 판정하지 않는다.

## 3. 수집·결속 증거

증거 원본은 `D:/workspace/Vocaflow-AI-Control/runtime/lcp-story-20261025/s7-rights-20261026/`에 보존한다.

- `manifest.json`: 2026-10-26T05:21:51.918Z 수집, 10개 공식·원출처 응답 HTTP200, URL·응답 유형·바이트·SHA-256.
- `facts-and-binding.json`: 원문 214문단 전량 비교, 원저자 사망일, 법률문·라이선스 확인, 자산 범위. 실제 분석 프로세스 exit0.
- `decision-packet.v2.json`: 원천·범위·문서·증거 파일 해시에 결속하는 승인 대상. 문서 원본도 같은 폴더의 `BLUE_CARBUNCLE_RIGHTS.v2.md`에 고정한다. v1 packet과 문서 사본은 이전 자료로 보존하며 승인 대상으로 사용하지 않는다. 사람 결정 수신 여부는 packet을 사후 수정하지 않고 별도 결정 영수증에 기록한다.
- 2026-10-26T05:22:09.96458Z 읽기 전용 DB 대조: 기존16단위·해시 일치, 독립 AI review1, 권리 결정0, witness0, release0. 이 수치는 해당 시점의 관측이다.

## 4. §14와 실제 DB 조건의 차이

정본 [§14](../LCP_STORY.md#14-자산-권리)는 “권리 확인은 사람이 근거와 함께 기록한다”고 규정한다. 이는 현재 제품 운영 조건이다. 위 저작권법 조항 자체가 이 서비스에 사람 검수 절차를 강제한다는 뜻은 아니다.

기존 `story_admin_record_rights`는 정상 인증된 active admin, 대상 source, asset, 상태, 근거·참조를 확인하지만 실제 인간인지 판별하지 않는다. 개발용 AI admin으로 RPC가 성공해도 사람 결정이 생긴 것으로 취급하면 안 된다. 계정 생성 승인·AI 콘텐츠 검수·이번의 조건부 발행 지시는 이 특정 자료에 대한 사람 권리 결정과 구분한다.

**아직 미충족:** 사용자가 이 자료를 근거로 해당 범위의 권리를 확인했다는 구체적인 결정. 별도 사람 검수자를 배정해 달라는 요청이 아니다.

실행 가능한 최소 기록 방식은 다음과 같다. 이 방식도 사용자의 명시적 수용 전에는 실행하지 않는다.

1. 사용자가 이 특정 원천·범위·증거와 **동일 원천의 다른 판본도 참조하는 source 단위 효과**를 근거로 `source_text` 권리를 확인하고, **사람 사용자 결정 + AI admin의 위임 기록** 방식을 명시적으로 수용한다.
2. 원래 사용자 결정의 참조·수신 시각·packet SHA를 별도 영수증에 보존한다. 이 문서나 원문·각색·기존 AI 검수를 사후 덮어쓰지 않는다.
3. 기존 정상 인증 admin 화면에서 `source_text / confirmed`를 기록한다. basis에 사람 결정의 출처와 AI 기술적 기록자를 구분하고 evidence_ref로 해당 영수증·packet을 가리킨다. DB의 인증 계정은 AI 개발 admin임을 숨기지 않는다.
4. 위 방식에 대한 §14 운영 해석을 문서에 명시한다. `HUMAN_REVIEWED`를 만들거나 AI 콘텐츠 검수를 사람 검수로 바꾸지 않는다. SQL·RLS·역할·발행 조건은 변경하지 않는다.
5. 그 뒤에만 기존 서버 validation witness와 정상 관리자 발행을 실행한다. 실제 학습자 독서·진도·철회 접근 검증은 발행 이후 별도 증거로 남긴다.

## 5. 현재 판정

| 항목 | 상태 |
|---|---|
| 출처·고정 판본·원문 전량 일치 | TECHNICALLY_VERIFIED |
| 권리 자료의 AI 조사 | AI_REVIEWED; 독립 자료 검토 결과는 별도 기록 |
| 기존 콘텐츠 독립 AI 검수 | 기존 approve 보존. 별도 재검수에서 안내 결함 발견, 보완·새 판 검수 진행 중; 사람 검수 아님 |
| 특정 자료에 대한 사람 권리 결정 | 미수신 |
| 권리 confirmed·정식 발행 | 미실행 |
| 발행 후 실제 인증 독서·철회 검증 | 선행 발행 대기 |
| 실제 학습자 적합성·독해 성장 | EDUCATION_EFFECT_UNVERIFIED |

기존 작품의 공개 근거가 확보돼 대체 작품을 새로 제작할 이유는 발견되지 않았다. 작품을 바꿔도 §14의 사람 결정 조건은 그대로다. 원문·각색·검수·계정·기존 S4/S5 구현은 유지한다.
