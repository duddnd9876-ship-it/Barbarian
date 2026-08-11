# Hex Claim (`hex-claim`)

문명5/6의 야만인 모드에서 착안한 턴제 멀티플레이 땅따먹기 전략 웹게임. 자세한 기획은 [`Docs/기획서.md`](./Docs/기획서.md) 참고.

## 현재 상태

GitHub Pages 정적 배포를 위해, 온라인 대전(파이어베이스 연동)이 붙기 전 **로컬 핫싯 모드**로 규칙 엔진과 클라이언트를 완성한 버전이다. 같은 화면에서 2~6인이 순서대로 턴을 넘겨가며 플레이할 수 있다. 파이어베이스 연동 후 온라인 대전으로 확장할 예정.

플레이: **https://duddnd9876-ship-it.github.io/Barbarian/**

## 개발

```bash
pnpm install
pnpm run dev        # 개발 서버
pnpm run test       # vitest 단위/시나리오 테스트
pnpm run typecheck  # tsc --noEmit
pnpm run build      # 프로덕션 빌드 (dist/)
```

## 구조

- `src/shared/` — 규칙 엔진. 순수 TS, 브라우저/React 의존성 없음 (헥스 좌표, 맵 생성, 전투 계산, 턴 리듀서).
- `src/state/` — zustand 게임 스토어.
- `src/render/`, `src/ui/` — SVG 헥스 보드, 로비/게임/종료 화면.

`main` 또는 배포 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 테스트 → 빌드 → GitHub Pages 배포를 자동으로 수행한다.
