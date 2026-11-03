import type { AcceptMode, DecisionBackend } from '../../domain/types';
import { engine } from '../../engine/store';
import { useEngine } from '../../hooks/useEngine';

const MODES: { id: AcceptMode; label: string; tip: string }[] = [
  { id: 'off', label: 'off', tip: '不接单' },
  { id: 'observe', label: 'observe', tip: '只记录本会接什么' },
  { id: 'auto', label: 'auto', tip: '命中才真接' },
];

export function AcceptModeControl() {
  const snap = useEngine();

  return (
    <section className="panel control-panel">
      <header className="panel-head">
        <h2>接单 & 决策</h2>
        <span className="muted">Accept / Backend</span>
      </header>

      <div className="seg">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={snap.acceptMode === m.id ? 'seg-btn active' : 'seg-btn'}
            title={m.tip}
            onClick={() => engine.setAcceptMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="seg" style={{ marginTop: 8 }}>
        {(['rules', 'llm'] as DecisionBackend[]).map((b) => (
          <button
            key={b}
            type="button"
            className={
              snap.decisionBackend === b ? 'seg-btn active' : 'seg-btn'
            }
            onClick={() => engine.setDecisionBackend(b)}
          >
            {b === 'rules' ? '规则引擎' : 'DeepSeek LLM'}
          </button>
        ))}
        <button
          type="button"
          className="seg-btn"
          onClick={() => void engine.refreshLlmStatus()}
        >
          刷新 LLM
        </button>
      </div>

      <p className={`llm-status ${snap.llmStatus.available ? 'ok' : 'warn'}`}>
        {snap.llmStatus.available
          ? `● LLM 就绪 ${snap.llmStatus.model ?? ''}`
          : `○ ${snap.llmStatus.message}`}
      </p>
    </section>
  );
}
