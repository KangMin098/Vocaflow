# C06 — The Open Window 원천 준비·D3 인계

> **T-0189 최신 실행 경계(2026-10-27)**: 특정 C06 source_text 권리 결정이 없으므로 원문 기반 제작(제작용 정규화·snapshot·제작 앵커·policy/export·각색·등록·발행)은 HOLD다. 기존 고정 TXT에 대한 raw UTF-8 줄/인용 위치 색인27개와 비실행 편집·보존·검수 계획 v2만 추가했다. raw 색인은 production UTF-16 SourceAnchor가 아니다. 준비 계획은 별도 범위 검토에서 수용됐으며 권리/법률 확인·판본 콘텐츠 승인·사람 효과를 뜻하지 않는다. [실행 결과](./D3_FOLLOWUP.md).

> T-0187 / D2 U2 · 2026-10-26 · **원천 준비 완료, 권리 confirmed·제작·발행 없음**. D2의 C06은 Saki(H. H. Munro)의 단편 The Open Window다. 후보 재선정이나 새로운 파이프라인이 아니다.
> 2026-10-27 [D3 인수](./LCP_D3_EDITIONS.md): 고정 TXT 해시를 다시 대조했고 전문을 읽어 주장/관찰·반복 단서·결말 보존 기준을 구체화했다. 첫 판본은 필요 최소 현대화 후보 하나로 검토하며 원천 정규화/앵커·특정 권리 결정은 계속 미실행이다.

## 원천과 판본

Project Gutenberg #269, Beasts and Super-Beasts, **1914 John Lane / The Bodley Head 판을 David Price가 전사한 영어본**을 조사 원천으로 선택했다. 공식 카탈로그와 본문 간기를 대조했다. 작가 서문은 이 단편의 앞선 게재지를 Westminster Gazette로 명시하지만 초출 지면/초출 날짜·인쇄판 스캔과 글자별 대조를 완료한 것은 아니다.

- 공식 서지: https://www.gutenberg.org/ebooks/269
- 전체 원문 TXT: https://www.gutenberg.org/cache/epub/269/pg269.txt
- HTML: https://www.gutenberg.org/cache/epub/269/pg269-images.html
- 공식 서지의 전자책 공개1995-05-01·업데이트2011-12-26와 HTTP Last-Modified2026-10-01은 서로 다른 메타데이터다. HTTP 날짜를 판본의 최초 출판일 또는 내용 수정일로 해석하지 않는다.

## 실제 확보와 고정 범위

2026-10-26T09:40:34Z 확보. 원 URL은 가변이므로 로컬 원본 바이트와 SHA를 고정했다. 제작용 SourceSnapshot을 만든 것은 아니다.

| 파일 | 바이트·SHA-256 |
|---|---|
| PG collection TXT | 392,717 / `058d0cda5a3c8449cbce06e0698048251881be4c6fc8d06fd0bc3a1bb8ec8587` |
| PG collection HTML | 409,891 / `5bd5fc41ac3bfc17ea40acb0f1e7bab02c1683103686f7e02d1e3593f99234bd` |
| 해당 단편 exact TXT | 7,195 / `050cca38bf540923ce935143a275c2a6aaf2fff26947c24d93e00f44bb674b27` |

로컬 근거는 `D:/workspace/Vocaflow-AI-Control/runtime/lcp-story-20261025/d2-followup-20261026/c06/source-manifest.json`과 같은 폴더의 원본 파일이다. 단편은 전체 TXT의 UTF-8 바이트 `[59044,66239)`를 그대로 잘랐다. `THE OPEN WINDOW` 표제부터 다음 `THE TREASURE SHIP` 표제 직전까지이며 표제/원래 공백/줄바꿈을 보존했다. 리라이팅·현대화·번역·내용 생략은 없다. root 재확보한 TXT/HTML 해시가 별도 비제작 조사 세션의 직접 확보 해시와 일치했다.

별도 조사자가 HTML의 해당 h2 구간29개 p와 약1,209단어를 직접 읽었다. root의 exact TXT에서는 표제를 제외하고 유니코드 공백으로 분리한 토큰이1,208개였다. 두 포맷의 계측 규칙과 결과를 같은 수로 덮지 않는다. `c06-source-verification.json`의 바이트/추출경계/끝문장 검사는6/6·실제exit0이다. 이 수는 CEFR 실측이 아니다. 다음 D3에서 실제 SourceSnapshot 추출 규칙·문단 앵커·해시를 확정할 때 다시 계측해야 한다. 현재 exact TXT는 원본 형식을 보존한 조사 자료다.

Standard Ebooks의 `saki/short-fiction`도 비교 가능하다. 고정 revision `9c3b28c9f2c5ec3d6757ce45d8124411ec22ae7c`의 `src/epub/text/the-open-window.xhtml`을 조사했고 PG의 to-day/men-folk/good-bye와 SE의 today/menfolk/goodbye처럼 실제 편집 차이가 있다. 이 판본을 PG 원문으로 섞거나 같은 해시로 기록하지 않는다. 이번 실제 고정 조사 원천은 PG다.

## 권리·이용 조건: 근거와 미충족을 분리

PG 해당 항목은 **미국 PD**로 표시한다. Saki의 생몰연도1870–1916과 1914판 서지는 원작 기간 만료 판단의 근거다. 영국 현행법 §12의 사후70년을 보수적으로 적용해도 기간 경과를 뒷받침한다는 산술적 조사 판단이며, 정확한 역사적 최초 소멸일이나 세계 전체의 권리를 확인한 결론은 아니다. 한국 제공에서는 제3조 외국 저작물, 제39조 기간, 제44조 기산과 적용 범위를 별도로 확인해야 한다. 생일/사망일의 일자 불일치 자료가 있어 여기서는 권리 조사에 필요한 확정 연도1916만 사용한다.

- English Heritage: https://www.english-heritage.org.uk/visit/blue-plaques/hector-hugh-munro-saki/
- UK §12: https://www.legislation.gov.uk/ukpga/1988/48/section/12?view=plain
- 한국 제39조: https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0039&lsiSeq=283335&urlMode=lsScJoRltInfoR
- 한국 제3조: https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0003&lsiSeq=283335&urlMode=lsScJoRltInfoR
- 한국 제44조: https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0044&lsiSeq=283335&urlMode=lsScJoRltInfoR
- PG 라이선스/브랜드·배포 조건: https://www.gutenberg.org/policy/license.html

이들은 **AI의 공개 근거 조사**다. 정본 §14의 특정 C06 사람 사용자 결정/AI admin 위임 기록은 없으며 source_text/confirmed가 아니다. C01 Doyle 승인도 재사용할 수 없다. 최신 사용자 경계에서는 특정 고정 원천/범위의 권리 결정이 제작용 정규화·snapshot·제작 앵커·policy/export·각색보다 선행한다. 지금은 기존 근거 조사와 비실행 계획만 계속하며 새 권리 승인을 반복 요청하지 않는다.

원작, PG 전사/간기, PG 상표·배포 조건을 구분한다. 출처를 표시하는 것과 PG 브랜드를 새 각색본 브랜드로 사용하는 것은 다르다. 그림·표지·오디오·폰트·새 번역을 이번 조사/사용 범위에 포함하지 않았다. 미래 각색본에서 라이선스 표시·수정 표시·상표 처리 방법을 확인해야 한다.

## 독자·언어·서사: 편집 가설

학습자R2(짧은 반전/장르), R3(인물 주장과 관찰 근거), R6(시간 제약)의 비교 후보다. 짧다는 이유로 기초 영어 입문자나 모든 연령에 적합하다고 하지 않는다. B1~B2 현대화 가능성을 D2에서 검토했으나 원문을 직접 읽은 조사자는 B2 목표를 제안했다. **확정된 CEFR/학습자 수준 판정이 아니며 D3에서 제공 방식별로 정한다.**

언어 부담은 소개 편지·방문 예절·French window·사냥/습지·mackintosh 등 배경과 긴 문장/관용 표현이다. 서사 부담은 베라가 방문객이 아는 정보를 확인하는 과정, 전해진 주장과 실제 관찰, 반복된 단서의 재해석, 화자의 불안과 마지막 즉석 이야기의 관계다. 개별 독자의 선호·이해를 확인한 자료는 없다.

주의 후보는 사망/실종 이야기, 사냥/총, 불안·공포·조롱, 무덤·위협하는 개, 식민지적 표현이다. **등장인물의 죽음 이야기를 서사 세계의 실제 확정 사건으로 바꾸지 않는다.** 이 조사 메모는 편집자용이므로 반전이 포함될 수 있으며 그대로 학습자 사전 안내나 HOOK에 공개하지 않는다.

## 제작 가능성과 D3 결정 사항

기존 외부 원천 snapshot→policy→edition→독립 검수→권리/증인/발행 자산은 재사용할 수 있다. 다만 현재 C06 특정 권리 결정이 없어 실제 제작은 HOLD다. 아래는 그 결정 뒤에만 실행할 비실행 계획이며, 현재 준비 v2와 검토 결과는 D3_FOLLOWUP에 기록했다.

1. PG 고정 바이트에서 문단/공백/유니코드 추출 규칙과 실제 SourceSnapshot을 생성·검증한다. SE를 선택한다면 별도 원천 판본으로 다시 결속한다.
2. 원작 보존/현대화/수준 각색 중 필요한 판본 하나와 목표를 정한다. 임의 새 각색 알고리즘, 여러 수준 일괄 생산, 강제 회차 분할은 확정하지 않는다.
3. 인물의 정보 확인, 전해진 비극과 관찰의 구분, 흰 외투·개·노래 단서, 결말의 의미를 preserve와 변경 기록에 연결한다. 원문 직접 대조 없이 자동 PASS하지 않는다.
4. HOOK/사전 안내에서 베라의 거짓말이나 반전을 먼저 밝히지 않는다. 주의 안내는 사실과 등장인물 주장을 구분하고 내용상 필요한 범위만 제공한다.
5. 새 판본은 제작에 참여하지 않은 AI 세션이 전문을 검수한다. 이 원천 조사를 판본 검수 승인이나 사람 검수로 기록하지 않는다.

원문 확보와 기존 기반의 재사용 가능성은 확인했다. 현재 허용된 편집·보존·검수 계획은 준비 완료다. 특정 C06 권리 결정이 제작용 정규화/snapshot/앵커·정책/export·현대화 제작보다 선행하며 이후에도 독립 전문 검수·정상 증인/발행 조건을 유지한다. 실제 제작·등록·발행은 HOLD다.
