# Vocaflow CLAUDE.md v06.9 적용 지시문

> CLAUDE.md v06.9를 워크스페이스에 적용하는 단순 작업입니다.
> 코드 변경 없음 — 문서 교체 + 변경 내용 확인만.

---

## 작업 내용

CLAUDE.md §17 학습 모델이 v2.0 → v3.0으로 재설계됐습니다.

### 변경 요약

| 항목 | v2.0 (기존) | v3.0 (신규) |
|------|------------|------------|
| 흐름 축 계층 수 | 6계층 (L0~L5) | **9계층** (L0~L4a/b/c/d~L5) |
| L2.5 Bridge | Dictation 억지 배치 | **폐지** |
| L4 | 게임 5종 동등 묶음 | **인지 부하 순서 4단계** |
| Dictation 위치 | L2.5 (L3 이전) | **L4c 청각생성** |
| 7원칙 매트릭스 | 6계층 기준 | **9계층 기준** |

### L4 분리 상세

```
L4a  재인 Recognition        Flashcard + WordBlitz
L4b  시각 생성 Generate-Visual  SpellForge
L4c  청각 생성 Generate-Audio   Dictation  ← 여기로 이동
L4d  통합 검증 Integrate        ScriptQuiz
```

---

## 단계 1 — CLAUDE.md 교체

첨부된 `CLAUDE.md`를 워크스페이스 루트에 덮어쓰기:

```bash
# Git Bash 기준
cd /c/Users/kille/Vocaflow

# 현재 버전 확인
head -8 CLAUDE.md | grep "문서 버전"
# 출력: > **문서 버전: v06.8** ...

# 교체 (다운로드한 CLAUDE.md 경로로 수정)
cp ~/Downloads/CLAUDE.md ./CLAUDE.md

# 교체 후 버전 확인
head -8 CLAUDE.md | grep "문서 버전"
# 기대 출력: > **문서 버전: v06.9** ...
```

---

## 단계 2 — 변경 내용 확인

교체 후 다음을 확인합니다:

```bash
# L2.5가 완전히 제거됐는지
grep -n "L2\.5\|Bridge" CLAUDE.md
# 기대: "L2.5 Bridge 폐지 이유" 설명 텍스트만 남고, 계층 테이블에서 사라짐

# L4a/b/c/d가 존재하는지
grep -n "L4a\|L4b\|L4c\|L4d" CLAUDE.md | head -10
# 기대: 10줄 이상 출력

# Dictation이 L4c에 위치하는지
grep -n "L4c.*Dictation\|Dictation.*L4c" CLAUDE.md | head -5
# 기대: 여러 줄 출력
```

---

## 단계 3 — 보고

```markdown
### CLAUDE.md v06.9 적용 완료

- 문서 버전: v06.8 → v06.9 ✓
- L2.5 Bridge 폐지 ✓
- L4 → L4a/b/c/d 4단계 분리 ✓
- Dictation L4c 정착 ✓
- 7원칙 × 9계층 매트릭스 갱신 ✓
- 코드 변경 없음 (문서 교체만)
```

---

## 이 변경이 기존 코드에 미치는 영향

**즉각적인 코드 변경 필요 없음.** 이유:

| 항목 | 영향 |
|------|------|
| `src/lib/srs/` (SRS 엔진) | 영향 없음 — 계층 재분류와 무관 |
| `src/lib/recommend/next-action.mock.ts` | 향후 개선 필요 — P3 Warm 분기에 L4b/c 구분 추가 가능 |
| `src/components/ui/MemoryBadge.tsx` | 영향 없음 |
| `src/components/home/HubHero.tsx` | 영향 없음 |
| `src/components/wordvault/WordRow.tsx` | 영향 없음 |
| `src/components/flashcard/FlashcardSession.tsx` | 영향 없음 |

**향후 작업 시 반영할 사항:**

추천 엔진(`next-action.ts`) 실제 버전 구현 시, P3 분기를 다음과 같이 세분화할 수 있음:

```typescript
// Warm 사용자 — shaky 단어 처리 시 L4b vs L4c 선택
// SpellForge(L4b): module_history에 'spellforge' 없는 shaky 단어
// Dictation(L4c): module_history에 'dictation' 없는 shaky 단어
// → 둘 다 없으면 SpellForge 먼저 (시각 → 청각 순서 권장)
```

이 세분화는 DB 연동 후 추천 엔진 구현 단계에서 반영.

---

이 지시문을 끝까지 읽었다면, **단계 1**부터 시작하세요.
