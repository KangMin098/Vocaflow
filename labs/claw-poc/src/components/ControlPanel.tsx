// labs/claw-poc/src/components/ControlPanel.tsx
import { useSequenceStore } from '../hooks/useSequence'

export function ControlPanel() {
  const state = useSequenceStore((s) => s.state)
  const start = useSequenceStore((s) => s.start)
  const reset = useSequenceStore((s) => s.reset)
  const targetX = useSequenceStore((s) => s.targetX)
  const targetZ = useSequenceStore((s) => s.targetZ)
  const setTarget = useSequenceStore((s) => s.setTarget)

  const disabled = state !== 'idle'

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 10,
        background: 'rgba(20,22,28,0.9)',
        border: '1px solid #333',
        borderRadius: 8,
        padding: 12,
        color: '#eee',
        fontSize: 13,
        minWidth: 240,
      }}
    >
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Claw PoC</div>
      <div style={{ marginBottom: 6, opacity: 0.75 }}>state: <b>{state}</b></div>
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 4, marginBottom: 8 }}>
        <label>target X</label>
        <input
          type="range"
          min={-1.6}
          max={1.6}
          step={0.1}
          value={targetX}
          onChange={(e) => setTarget(Number(e.target.value), targetZ)}
          disabled={disabled}
        />
        <label>target Z</label>
        <input
          type="range"
          min={-1.6}
          max={1.6}
          step={0.1}
          value={targetZ}
          onChange={(e) => setTarget(targetX, Number(e.target.value))}
          disabled={disabled}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={start} disabled={disabled} style={btn}>
          PLAY
        </button>
        <button onClick={reset} style={btn}>
          RESET
        </button>
      </div>
      <div style={{ marginTop: 10, opacity: 0.6, fontSize: 11, lineHeight: 1.4 }}>
        1) target XZ 지정 → PLAY<br />
        2) claw XY 이동 → 하강 → grip → 상승 → chute 이동 → release<br />
        3) Leva 노브로 gripStiffness / plushFriction / plushMass 튜닝
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  background: '#2a2e38',
  color: '#eee',
  border: '1px solid #444',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
}
