> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_spec_memory_claims_unverified.md
> category: feedback

---

사용자가 큰 spec 문서를 paste 할 때 spec 안에 "메모리 v06.x — XXX 최우선 gap" 또는 "메모리 명시" 같은 메모리 근거 주장이 자주 등장. **이 주장은 거의 항상 사실과 다름**.

**Why:** 동일 패턴 5차 반복:
1. v06.30 — `auto_curate_book(uuid)` "큐레이션 진입점" 주장 → 정찰 결과 status 게이팅 함수 (단어장 INSERT 0)
2. v06.30 — 18-결정 문서가 4-Gate 시스템·신규 마스터 테이블 3종 over-spec
3. v06.31 — 사용자 spec "도서↔단어장 분리" — 이미 80% 구현되어 있었음
4. v06.32 — 라이브러리 도서 자동 trigger over-spec → 실제는 ALTER 6건 + RPC 1개로 95% 축소
5. v06.32 — EchoMatch spec "메모리 — 최우선 gap" 주장 → MEMORY.md + 59개 memory 파일 grep 결과 0건 매치

**How to apply:**
- 큰 spec 문서를 받으면 spec 의 "메모리 명시" / "메모리 v06.x" / "이전 결정" 주장을 **항상 grep 으로 사전 검증**: `grep -rli "<keyword>" "C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/"`
- DB 인프라 주장도 동일 검증 (테이블·함수·라우트 존재 여부 SELECT 정찰)
- 라이브러리 의존성 주장도 검증 (`package.json` grep)
- 검증 후 진짜 gap 만 식별 → 사용자에게 옵션 제시 (stub / PoC / 풀 모듈)
- 사용자 0명 단계에서는 **stub > PoC > 풀 모듈** 우선순위 권고 (over-engineering 방지)
- 5차 반복된 이 패턴은 향후에도 반복될 확률 높음 — 정찰 없이 spec 따라가면 시간 낭비

관련: [[feedback-auto-curate-book-is-gating]] (함수명 추정 오류) · [[project-library-chapter-word-sets]] (v06.30 over-spec 차단)

