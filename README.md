# Hex Claim (`hex-claim`)

문명5/6의 야만인 모드에서 착안한 턴제 멀티플레이 땅따먹기 전략 웹게임. 자세한 기획은 [`Docs/기획서.md`](./Docs/기획서.md) 참고.

## 현재 상태

플레이: **https://hex-claim.duddnd9876.workers.dev**

프론트엔드(React SPA)와 백엔드(권위 서버)를 모두 **Cloudflare Workers** 하나로 배포한다.

- **로컬 핫싯**: 같은 화면에서 2~6인이 순서대로 턴을 넘겨가며 플레이. 서버 없이 브라우저에서만 동작.
- **온라인 대전**: 방 코드로 입장하는 실시간 멀티플레이. 방 하나 = **Durable Object** 하나가 `src/shared` 규칙 엔진으로 모든 명령을 판정하는 권위 서버 역할을 한다. WebSocket으로 통신하며, 45초 턴 타이머는 Durable Object의 Alarm으로 서버가 직접 관리한다.

## 개발

```bash
pnpm install
pnpm run dev            # 클라이언트만 (Vite 개발 서버, 온라인 대전은 동작 안 함)
pnpm run test            # vitest — 규칙 엔진 단위/시나리오 테스트
pnpm run typecheck       # 클라이언트 tsc --noEmit
pnpm run cf:typecheck     # 워커 tsc --noEmit (wrangler types 재생성 포함)
pnpm run build            # 프로덕션 빌드 (dist/)

pnpm run cf:dev           # 빌드 + wrangler dev — 로컬에서 프론트+백엔드(Durable Object) 전체 실행
pnpm run cf:deploy        # 빌드 + wrangler deploy — Cloudflare에 배포 (계정 인증 필요)
```

`cf:dev`/`cf:deploy`는 Cloudflare 계정 로그인이 필요하다: 처음 한 번 `npx wrangler login`을 실행하거나, CI에서는 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` 시크릿을 사용한다.

## 구조

- `src/shared/` — 규칙 엔진. 순수 TS, 브라우저/서버 의존성 없음 (헥스 좌표, 맵 생성, 전투 계산, 턴 리듀서). 클라이언트와 Worker(Durable Object)가 **같은 코드**를 그대로 import해서 쓴다.
- `src/state/` — zustand 스토어. `gameStore`(로컬 핫싯), `onlineGameStore`(온라인, WebSocket으로 서버 상태를 받아옴).
- `src/net/protocol.ts` — 클라이언트-서버 WebSocket 메시지 타입 (`worker/protocol.ts`와 반드시 함께 수정).
- `src/render/`, `src/ui/` — SVG 헥스 보드, 로비/대기실/게임/종료 화면.
- `worker/index.ts` — Worker 진입점. `/api/rooms`(방 생성), `/ws/:code`(WebSocket 업그레이드 → Durable Object로 위임), 그 외는 정적 자산(SPA)으로 서빙.
- `worker/gameRoom.ts` — `GameRoom` Durable Object. 방 하나의 로비/게임 상태를 SQLite에 영속화하고, WebSocket Hibernation API로 연결을 관리하며, `src/shared/reducer`로 명령을 판정한다.

`main` 또는 배포 브랜치에 푸시하면 `.github/workflows/deploy-cloudflare.yml`이 테스트 → 빌드 → `wrangler deploy`를 자동으로 수행한다 (저장소에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 시크릿이 설정되어 있어야 한다).
