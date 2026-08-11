import { useState } from 'react'
import { hashStringToSeed } from '../shared/rng'
import { useGameStore } from '../state/gameStore'

const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4']
const PLAYER_COUNTS = [2, 3, 4, 5, 6]

export function Lobby() {
  const startGame = useGameStore((s) => s.startGame)
  const [count, setCount] = useState(2)
  const [seedText, setSeedText] = useState('')

  const handleStart = () => {
    const players = Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      name: `플레이어 ${i + 1}`,
      color: COLORS[i],
    }))
    const trimmed = seedText.trim()
    const seed = trimmed ? hashStringToSeed(trimmed) : undefined
    startGame(players, seed)
  }

  return (
    <div className="lobby">
      <h1>Hex Claim</h1>
      <p className="lobby-desc">
        같은 화면에서 순서대로 턴을 넘겨가며 플레이하는 로컬 핫싯 모드입니다.
        <br />
        온라인 대전은 파이어베이스 연동 후 추가될 예정입니다.
      </p>

      <label className="lobby-field">
        인원 수
        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {PLAYER_COUNTS.map((n) => (
            <option key={n} value={n}>
              {n}인
            </option>
          ))}
        </select>
      </label>

      <label className="lobby-field">
        맵 시드 (선택, 비워두면 매번 랜덤)
        <input
          value={seedText}
          onChange={(e) => setSeedText(e.target.value)}
          placeholder="예: hex-claim-01"
        />
      </label>

      <button className="lobby-start" onClick={handleStart}>
        게임 시작
      </button>

      <ul className="lobby-rules">
        <li>기지를 비우면 빼앗기고, 소유 기지가 0개가 되면 탈락합니다.</li>
        <li>험지는 방어 +50%, 기지는 +25%, 주둔(FORTIFY)은 +20%.</li>
        <li>회복은 자기 기지 위에서 공격 없이 턴을 마쳤을 때만 (+25 HP).</li>
        <li>유닛이 죽으면 3턴 뒤 소유 기지 중 하나에서 50% HP로 부활합니다.</li>
      </ul>
    </div>
  )
}
