# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # 개발 서버 실행 (http://localhost:5173)
npm run build    # 타입 체크 후 프로덕션 빌드 (tsc -b && vite build)
npm run lint     # ESLint 검사
npm run preview  # 빌드 결과물 미리보기
```

테스트 프레임워크는 현재 없음.

## 아키텍처

React 19 + TypeScript + Vite 기반의 단일 페이지 바둑 웹앱.

### 상태 흐름

게임 상태(`board`, `currentTurn`)는 모두 `App`에서 관리하며, `Board`는 순수 렌더링 컴포넌트다.

```
App (상태 소유)
 ├── board: Stone[][]  — 9×9 격자, 각 칸은 'black' | 'white' | null
 ├── currentTurn: 'black' | 'white'
 └── Board (SVG 렌더러)
      └── onPlace(row, col) 콜백으로 App에 착수 요청
```

### 핵심 타입

`Stone` 타입은 `App.tsx`에서 export해 `Board.tsx`가 import하는 구조:

```ts
export type Stone = 'black' | 'white' | null
```

### Board SVG 좌표 체계

`Board.tsx`의 상수:
- `SIZE = 9` — 교점 수
- `CELL = 52` — 교점 간 픽셀 간격
- `PADDING = 40` — 가장자리 여백
- SVG 전체 크기: `CELL * (SIZE - 1) + PADDING * 2 = 456px`
- 교점 `(row, col)`의 픽셀 좌표: `(PADDING + col * CELL, PADDING + row * CELL)`

화점(별점)은 `STAR_POINTS` 배열로 하드코딩(`[row, col]` 쌍).

각 교점마다 투명 `<rect>`(클릭 영역)와 조건부 `<circle>`(돌)을 SVG `<g>`로 묶어 렌더링.

## UI 규칙: 모바일 우선

**모든 UI 작업은 모바일 기준으로 먼저 만든다.** 데스크톱은 `max-width`로 중앙 정렬하는 방식으로 대응.

### 적용된 모바일 최적화 패턴

- **핀치줌 차단**: `index.html` viewport에 `maximum-scale=1.0, user-scalable=no` 유지
- **동적 뷰포트 높이**: `min-height: 100dvh` 사용 (`100vh`는 모바일 브라우저 주소창 때문에 부정확)
- **안전 영역**: 하단 버튼에 `padding-bottom: max(20px, env(safe-area-inset-bottom))` 적용 (iPhone 홈바)
- **터치 딜레이 제거**: 버튼에 `touch-action: manipulation` 적용
- **탭 하이라이트 제거**: 버튼에 `-webkit-tap-highlight-color: transparent`
- **SVG 터치**: SVG에 `touch-action: none` — 브라우저가 터치를 스크롤/줌으로 가로채지 않도록

### SVG 반응형 크기 조정 방법

고정 `width`/`height` 속성 없이 `viewBox`만 지정하고 CSS로 `width: 100%` 설정. 내부 좌표계(viewBox)는 그대로 유지되어 교차점 터치 정확도가 보장됨.

```tsx
<svg viewBox="0 0 456 456" style={{ width: '100%', display: 'block', touchAction: 'none' }}>
```

### 레이아웃 구조

```
.app (flex column, min-height: 100dvh)
 ├── .header  — 타이틀 + 상태 (상단)
 ├── .board-container  — 바둑판 (너비 100%)
 └── .footer  — 리셋 버튼 (flex: 1로 남은 공간 채우며 하단 고정)
```

### 트리 뷰 기능
- 각 수(move)는 노드이고, 자식 노드 배열을 가진다
- 첫 자식이 메인 라인, 나머지는 변화도
- 노드는 위치, 색깔, 부모 노드, 자식 노드 배열, 코멘트 필드를 가진다
- 현재 위치는 루트부터 현재 노드까지의 경로로 표현한다
- 변화도 데이터 구조는 SGF 표준과 호환되도록 설계한다. 나중에 SGF 파일 저장/불러오기 기능을 추가할 예정이다.

## 문제 저장 및 갤러리 기능

- **PNG 썸네일 생성**: 저장 버튼을 누르면 현재 바둑판을 SVG → Canvas → PNG 순으로 변환해 썸네일 이미지를 생성한다.
- **IndexedDB 저장**: 썸네일(PNG) + SGF 데이터 + 제목/날짜를 한 세트로 IndexedDB에 저장한다.
- **폴더 분류**: 문제를 폴더 단위로 분류할 수 있다.
- **갤러리 화면**: 썸네일 그리드 방식으로 표시한다 (인스타그램 스타일, 한 줄에 3개).
- **불러오기**: 갤러리에서 썸네일을 탭하면 해당 SGF를 바둑판에 불러온다.