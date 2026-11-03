import { listInjectorButtons } from '../../engine/fakeEvents';
import { engine } from '../../engine/store';
import { runDemoScenario } from '../../engine/demoScenario';
import { useEngine } from '../../hooks/useEngine';
import { useState } from 'react';

export function EventInjectors() {
  const snap = useEngine();
  const [demoStatus, setDemoStatus] = useState('');

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>事件注入 Trigger</h2>
        <span className="muted">假事件 · 无真实账号</span>
      </header>

      <div className="btn-row">
        <button
          type="button"
          className="btn primary"
          disabled={snap.demoRunning}
          onClick={() => {
            void runDemoScenario(setDemoStatus);
          }}
        >
          ▶ 脚本演示 Scenario
        </button>
        <button type="button" className="btn" onClick={() => engine.reset()}>
          重置
        </button>
      </div>
      {demoStatus ? <p className="demo-status">{demoStatus}</p> : null}

      <div className="injector-grid">
        {listInjectorButtons().map((b) => (
          <button
            key={b.key}
            type="button"
            className={`btn inject kind-${b.sourceKind}`}
            disabled={snap.demoRunning || snap.evaluating}
            onClick={() => engine.injectTemplate(b.key)}
          >
            {b.label}
          </button>
        ))}
      </div>
    </section>
  );
}
