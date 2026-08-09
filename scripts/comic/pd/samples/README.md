# 자기발전 정답 표본 (truth)

`tune.mjs` 가 파라미터를 채점할 때 쓰는 **사람이 센 정답**이다.

## 왜 여기 있나

정답 세기가 이 하네스에서 제일 비싼 작업이다 — 페이지를 실제로 열어 컷을 하나씩 세야 한다.
그런데 표본 폴더(`work/pdcp/<이름>/`)는 `.gitignore` 대상이라, 작업 디렉터리를 지우는 순간
그 노동이 통째로 사라지고 스윕을 재현할 수 없다. 그래서 **정답만 저장소에 남긴다.**

이미지는 남기지 않는다(수 MB × 페이지 수). 아래 출처에서 다시 만들 수 있다.

## 표본 재구성

| 표본 | 출처 | 만드는 법 |
|---|---|---|
| `_tune` | All Top Comics #6 (Norlen 1959) — IA `DCMGoldenAge` 의 CBZ | CBZ 를 `assist.mjs` 정규화로 풀고 `restore.mjs` → `restored/` 에 `0003·0005·0008` |
| `_tune-ci` | Classics Illustrated #27 The Spy — IA `ClassicsIllustrated027TheSpy` | `acquire.mjs --pages 4` → `restore.mjs` → `restored/` 에 `0004` |

```bash
# 정답을 작업 폴더로 복사한 뒤 스윕
cp scripts/comic/pd/samples/_tune/truth.json work/pdcp/_tune/
node scripts/comic/pd/tune.mjs segment --sample work/pdcp/_tune
```

## 정답을 적을 때

- **만화 지면만 넣는다.** 광고·표지를 섞으면 스윕 승자가 거기 끌려간다(실측: 첫 CI 스윕의
  1위 a1500/d3 가 광고 한 장에 끌려간 결과였다).
- 컷은 눈으로 센다. 프록시 지표로 대신하면 과분할이 이긴다.
