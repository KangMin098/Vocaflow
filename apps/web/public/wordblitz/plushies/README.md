# Plushie GLB 파일 배치 가이드

## 결론

이 폴더(`apps/web/public/wordblitz/plushies/`)에 **9개 GLB 파일을 정확한 파일명**으로 배치해야 합니다.

---

## 필요한 파일 (캡처 파일명 기준)

```
apps/web/public/wordblitz/plushies/
├ Bear.glb
├ Carrot Character.glb        ← 공백 포함, 정확히 이대로
├ Cool Bannana Guy.glb        ← 'Bannana' (오타지만 원본 그대로)
├ Dog.glb
├ Easter rabbit.glb           ← 공백 + 소문자 r
├ Frog Hat.glb
├ Kitten.glb
├ Panda.glb
└ Unicorn.glb
```

---

## 중요 - 파일명 정확히 일치

대소문자, 공백, 오타 모두 **다운로드 파일 그대로** 유지해야 합니다.

코드의 `data.ts`가 위 파일명에 정확히 매칭됩니다:

```typescript
// data.ts
modelUrl: '/wordblitz/plushies/Bear.glb',
modelUrl: '/wordblitz/plushies/Easter rabbit.glb',  // 공백 OK
modelUrl: '/wordblitz/plushies/Cool Bannana Guy.glb', // 'Bannana' OK
```

**Next.js가 자동으로 URL encoding 처리**하므로 공백이 있어도 동작합니다.

---

## 배치 방법

### Option 1: VS Code Explorer 드래그
```
1. VS Code 좌측 Explorer에서 
   apps/web/public/wordblitz/plushies/ 폴더 열기
2. 9개 GLB 파일을 폴더에 드래그
```

### Option 2: 파일 탐색기 복사
```
Windows 파일 탐색기에서:
C:\Users\kille\Vocaflow\apps\web\public\wordblitz\plushies\
→ 9개 GLB 파일 복사 + 붙여넣기
```

### Option 3: Git Bash 명령어
```bash
# 다운로드 폴더에서 9개 파일을 한 번에 복사
cd /c/Users/kille/Downloads
cp Bear.glb Carrot\ Character.glb Cool\ Bannana\ Guy.glb Dog.glb Easter\ rabbit.glb Frog\ Hat.glb Kitten.glb Panda.glb Unicorn.glb /c/Users/kille/Vocaflow/apps/web/public/wordblitz/plushies/
```

---

## 일부만 배치해도 OK

GLB 9개 모두 받지 못해도 게임 동작합니다.
받지 않은 인형은 자동 sphere 폴백으로 표시됩니다.

```
받은 파일만 사실적 모델
받지 못한 파일은 단순 sphere
```

---

## 확인 방법

배치 후 Git Bash에서:

```bash
cd /c/Users/kille/Vocaflow/apps/web/public/wordblitz/plushies
ls -la
```

**예상 출력**:
```
Bear.glb
Carrot Character.glb
Cool Bannana Guy.glb
Dog.glb
Easter rabbit.glb
Frog Hat.glb
Kitten.glb
Panda.glb
Unicorn.glb
README.md
```

---

## 문제 해결

### 문제: 게임 화면에 인형이 sphere로만 보인다
**원인**: GLB 파일이 없거나 파일명 불일치

**해결**:
1. 파일명에 오타 있는지 확인 (대소문자, 공백 포함)
2. F12 → Console에서 404 에러 확인
3. 정확한 파일명으로 변경

### 문제: 콘솔에 "Failed to load resource: 404"
**원인**: 파일명이 data.ts와 다름

**해결**:
- `apps/web/src/lib/wordblitz/data.ts`의 `modelUrl` 확인
- 실제 파일명과 정확히 일치하는지 확인
