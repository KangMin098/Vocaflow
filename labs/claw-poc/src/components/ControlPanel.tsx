// labs/claw-poc/src/components/ControlPanel.tsx
import { useEffect } from 'react'
import { useSequenceStore } from '../hooks/useSequence'

const CAB_LIMIT = 1.6
const STEP = 0.15

export function ControlPanel() {
  const state = useSequenceStore((s) => s.state)
  const start = useSequenceStore((s) => s.start)
  const targetX = useSequenceStore((s) => s.targetX)
  const targetZ = useSequenceStore((s) => s.targetZ)
  const setTarget = useSequenceStore((s) => s.setTarget)

  const disabled = state !== 'idle'

  const nudge = (dx: number, dz: number) => {
    if (disabled) return
    const nx = Math.max(-CAB_LIMIT, Math.min(CAB_LIMIT, targetX + dx))
    const nz = Math.max(-CAB_LIMIT, Math.min(CAB_LIMIT, targetZ + dz))
    setTarget(nx, nz)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') nudge(-STEP, 0)
      else if (e.key === 'ArrowRight') nudge(STEP, 0)
      else if (e.key === 'ArrowUp') nudge(0, -STEP)
      else if (e.key === 'ArrowDown') nudge(0, STEP)
      else if (e.key === ' ' || e.key === 'Enter') start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div style={panelWrap}>
      {/* PLAYER 01 badge */}
      <div style={playerBadgeWrap}>
        <div style={playerBadge}>01</div>
        <div style={playerLabel}>PLAYER</div>
      </div>

      {/* D-pad */}
      <div style={dpadWrap}>
        <button style={{ ...dpadBtn, ...dpadHoriz }} onClick={() => nudge(0, -STEP)} disabled={disabled} aria-label="up">▲</button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={dpadBtn} onClick={() => nudge(-STEP, 0)} disabled={disabled} aria-label="left">◀</button>
          <div style={dpadCenter}>
            <div style={coordLabel}>X {targetX.toFixed(1)}</div>
            <div style={coordLabel}>Z {targetZ.toFixed(1)}</div>
          </div>
          <button style={dpadBtn} onClick={() => nudge(STEP, 0)} disabled={disabled} aria-label="right">▶</button>
        </div>
        <button style={{ ...dpadBtn, ...dpadHoriz }} onClick={() => nudge(0, STEP)} disabled={disabled} aria-label="down">▼</button>
      </div>

      {/* Big DROP button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <button
          style={{ ...dropBtn, ...(disabled ? { filter: 'grayscale(0.4) brightness(0.85)' } : {}) }}
          onClick={start}
          disabled={disabled}
          aria-label="drop"
        >
          <div style={{ fontSize: 20 }}>🎀</div>
          <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 900, color: '#ff5c8f', marginTop: 2 }}>DROP</div>
        </button>
        <div style={stateLabel}>state: {state}</div>
      </div>

      {/* PLAYER 02 badge */}
      <div style={playerBadgeWrap}>
        <div style={{ ...playerBadge, background: 'linear-gradient(180deg, #b0e0ff 0%, #7ec0f0 100%)' }}>02</div>
        <div style={playerLabel}>PLAYER</div>
      </div>
    </div>
  )
}

const panelWrap: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 20,
  transform: 'translateX(-50%)',
  zIndex: 10,
  display: 'flex',
  gap: 20,
  alignItems: 'center',
  background: 'linear-gradient(180deg, #ffffff 0%, #ffe8f2 100%)',
  padding: '14px 26px',
  borderRadius: 28,
  border: '4px solid #ff9dc0',
  boxShadow: '0 8px 24px rgba(255,150,200,0.6), inset 0 -4px 0 rgba(255,180,220,0.4)',
}

const playerBadgeWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
}

const playerBadge: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  padding: '4px 12px',
  background: 'linear-gradient(180deg, #ffe4ec 0%, #ffb0d0 100%)',
  border: '3px solid #fff',
  borderRadius: 14,
  color: '#a04870',
  minWidth: 40,
  textAlign: 'center',
  boxShadow: '0 2px 8px rgba(255,150,200,0.5)',
  fontFamily: '"Impact", sans-serif',
}

const playerLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#c88ba8',
  letterSpacing: 2,
  fontWeight: 800,
}

const dpadWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: 10,
  background: 'linear-gradient(180deg, #fff5fa 0%, #ffd8ea 100%)',
  border: '3px solid #ffc8e0',
  borderRadius: 18,
  boxShadow: 'inset 0 -2px 0 rgba(255,180,220,0.5)',
}

const dpadBtn: React.CSSProperties = {
  width: 42,
  height: 42,
  background: 'linear-gradient(180deg, #fff 0%, #ffe4ec 100%)',
  color: '#ff5c8f',
  border: '2px solid #ffb0d0',
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 900,
  cursor: 'pointer',
  boxShadow: 'inset 0 -3px 0 rgba(255,180,220,0.5), 0 2px 6px rgba(255,150,200,0.3)',
}

const dpadHoriz: React.CSSProperties = {}

const dpadCenter: React.CSSProperties = {
  width: 42,
  height: 42,
  background: 'linear-gradient(180deg, #fff8fb 0%, #ffe4ec 100%)',
  border: '2px dashed #ffc8e0',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
}

const coordLabel: React.CSSProperties = {
  fontSize: 8,
  color: '#c88ba8',
  fontWeight: 800,
  letterSpacing: 0.5,
}

const dropBtn: React.CSSProperties = {
  width: 90,
  height: 90,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #fff0f6 55%, #ffd8ea 100%)',
  border: '4px solid #ff9dc0',
  fontWeight: 900,
  cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(255,150,200,0.6), inset 0 -6px 0 rgba(255,180,220,0.4)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}

const stateLabel: React.CSSProperties = {
  fontSize: 9,
  color: '#c88ba8',
  fontWeight: 800,
  letterSpacing: 1,
}
