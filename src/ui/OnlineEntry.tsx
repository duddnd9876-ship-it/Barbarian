import { useState } from 'react'
import { useOnlineGameStore } from '../state/onlineGameStore'

export function OnlineEntry() {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const createRoom = useOnlineGameStore((s) => s.createRoom)
  const joinRoom = useOnlineGameStore((s) => s.joinRoom)
  const error = useOnlineGameStore((s) => s.error)

  const displayName = name.trim() || '플레이어'

  return (
    <div className="online-entry">
      <p className="lobby-desc">Cloudflare Durable Object가 판정하는 진짜 온라인 대전입니다. (2~6인)</p>

      <label className="lobby-field">
        이름
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="닉네임 (선택)" />
      </label>

      {error && <p className="error-banner">{error}</p>}

      <button className="lobby-start" onClick={() => createRoom(displayName)}>
        새 방 만들기
      </button>

      <div className="online-join-row">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="방 코드 입력"
          maxLength={10}
        />
        <button disabled={!joinCode.trim()} onClick={() => joinRoom(joinCode, displayName)}>
          입장
        </button>
      </div>
    </div>
  )
}
