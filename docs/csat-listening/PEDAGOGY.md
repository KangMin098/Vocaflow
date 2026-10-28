# 수능 듣기 18유형 — 교수 설계

> 코드 정본: `apps/web/src/lib/csat/listening/pedagogy.ts`(유형 id = `scripts/csat/data/listening/*.json` 의 `typeGuess`, `L-RESPONSE` 만 1·2번 SHORT / 13·14번 LONG 로 나눔).
> 분포(로컬 JSON): RESPONSE 64(SHORT·LONG 각 32) · PURPOSE·PICTURE·REASON·MONEY·NOTMENTION·ANNOUNCE·TABLE·SITUATION·SET-TOPIC·SET-NOT 각 16 · OPINION·TODO 15 · RELATION 14 · MAIN 2 · FAVOR 1 · TOPIC 1.
> 원칙(DECISIONS CL-SL-2 · dev 정책): 화면은 구조·대조·선택·근거 추적으로 판단을 일으킨다. 설명문 덤프·균일 체크리스트 없음. 자유서술 채점 없음. 조작은 화면 상태만 바꾸고 숙달 기록에 넣지 않는다. 학습 효과는 주장하지 않는다.
> 데이터에 선택지가 없어 오답 구성은 **대본 안의 유인 정보**로 근거를 댄다.

| 유형 | 측정 기능 · 판단 | 지배 판단 | 오답 구성(대본 근거) | 화면 조작 |
|---|---|---|---|---|
| RESPONSE-SHORT | 직전 화행 인식 | 앞뒤 연결 · 부탁/제안 | 부분 일치·역할 뒤바뀜 — 2017#1 "Do you want me to take a look at your résumé?"(제안 → 수락/거절 응답) | 마지막 발화 화행 꼬리표 고르고 응답 후보를 짝지어 대조 |
| RESPONSE-LONG | 누적 맥락 유지 | 앞뒤 연결 · 전체 중심 | 2023#11 "My helmet feels too tight"— 헬멧 사 달라는 앞 요청과 둘 다 맞아야 함 | 응답 후보가 기대는 앞 발화를 짚어 고리 잇기 |
| PURPOSE | 배경↔행동 촉구 구분 | 발화 목적 · 화자 의도 | 언급됐지만 목적 아님 — 2023#1 상품·배포("bookmarks… distributed") vs 목적 "make sure you … submit your application" | 배경/요청 전환 줄 하나 고르기 |
| OPINION | 지정 화자 주장 추적 | 화자 의도 · 근거↔오답 | 역할 뒤바뀜 — 2023#2 "Apple peels are effective…"는 여자 주장, 남자 반응과 분리 | 줄을 화자×주장/근거 칸에 분류 |
| MAIN | 예시→요지 일반화 | 전체 중심 | 부분 일치 — M2406#3 "camping, gardening…" 예시 vs "you need a hobby that can help clear your mind" | 예시 줄을 상위 문장 아래로 연결 |
| TOPIC | 대화 화제 묶기 | 전체 중심 | 부분 일치 — M1909#4 "saves space" · "good for the environment" 각각 vs toy rental 장점 전체 | 하위 항목을 화제 후보 위에 덮어 보기 |
| RELATION | 역할 추론 | 관계·역할 | 역할 뒤바뀜 — 2023#3 "your bestselling books"(작가) · "trained children who became Olympic swimming champions"(코치) | 단서 구절을 화자 A/B 칸에 배치 |
| PICTURE | 공간·속성 대응 | 수치·장소 | 속성 하나 변조 — 2023#4 "bear statue wearing the check pattern jacket" · "two flowerpots" · "round table" | 발화 ↔ 그림 영역 눌러 짝 짓기 |
| TODO | 담당자·완료 추적 | 부탁/제안 · 시점 | 시점·역할 함정 — 2023#5 "I already sent text messages"(완료) · "Could you wrap them? Sure"(남자) vs "I'll contact the band"(여자) | 할 일 카드를 완료/남자/여자 칸으로 이동 |
| FAVOR | 제안과 부탁 구별 | 부탁/제안 · 관계 | 2019#7 여자 제안 "I'll take some pictures for you" → 거절·다른 부탁("But my brother Tom…") | 제안/부탁 방향 화살표 + 수락 표시 |
| REASON | 부정되는 추측 소거 | 근거↔오답 | 언급됐지만 이유 아님 — 2023#7 "working at the movie theater?" "No" · "economics exam?" "already took" → "take my younger sister to the air[port]" | 이유 카드마다 부정 발화를 짚어 지우기 |
| MONEY | 계산식 구성 | 수치 | 계산 함정 — 2023#6 "$5 … vegetable sticks", "four packs", "$25 … Two tickets" | 숫자를 단가/수량/할인 칸에 끼워 식 조립·비교 |
| NOTMENTION | 언급 항목 대조 | 수치·장소 · 근거↔오답 | 2023#8 장소 "Lily Pond Park" · 인원 "180 students" · 소요 "almost three hours" 는 언급됨 | 선택지를 근거 줄에 연결해 지우기 |
| ANNOUNCE | 세부 한정어 대조 | 수치·시간 | 부분 일치·시점 — 2023#9 "Just on the opening day … lecture", "online purchase only" | 선택지 ↔ 원문 줄 나란히 놓고 바뀐 낱말 표시 |
| TABLE | 조건 순차 적용 | 수치 · 앞뒤 연결 | 2023#10 "up to $200" · "don't want the velvet" · "at least 50 inches" · "don't need [wheels]" | 조건을 표 열에 걸어 행 지우기, 조건 순서 바꿔 보기 |
| SITUATION | 의도 단계 추출 | 화자 의도 · 발화 목적 | 2023#15 "no single activity … interest all" → "wants to suggest … plan more [activities]"; 위로·일반 조언은 의도 불일치 | 서술을 상황/문제/의도 칸에 놓고 선택지 맞대기 |
| SET-TOPIC | 열거 구조 파악 | 전체 중심 | 부분 일치 — 2023#16 "contribution of metals to the development of civilization" vs 개별 "gold… silver… iron" | 열거 신호(First/Second/Next)를 가지로 펼친 도식 |
| SET-NOT | 열거 개체 추적 | 근거↔오답 | 2023#17 gold·silver·iron 등 열거 vs 빠진 금속 | SET-TOPIC 도식 가지에 선택지 개체 끼우기 |

## 첫 UI 추천

1. **TABLE**(`table-filter`) — 표가 이미 화면 구조이고, 조건 하나가 행을 지우는 결과가 즉시 보인다. 정답 근거가 대본의 조건 문장에 1:1로 묶여 근거 추적·조건 조작을 그대로 구현할 수 있다(16문항).
2. **REASON**(`cause-elimination`) — 대본 안에 "추측 → No/Actually 부정 → 진짜 이유" 구조가 반복돼, 오답이 왜 오답인지 원문 줄로 보여 줄 수 있다. 근거↔오답 충돌을 가장 선명하게 드러낸다(16문항).
