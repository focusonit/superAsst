import { engine } from '../../engine/store';
import { useEngine } from '../../hooks/useEngine';

const STATUS_LABEL: Record<string, string> = {
  idle: '空闲',
  running: '进行中',
  waiting_human: '等人拍板',
  ready: '就绪',
  stalled: '🐕 空转',
  done: '完成',
  cancelled: '取消',
};

export function WorkerBoard() {
  const snap = useEngine();

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Worker 看板</h2>
        <span className="muted">{snap.workers.length} workers</span>
      </header>

      {snap.workers.length === 0 ? (
        <p className="empty">尚无 Worker。注入可接事件或跑脚本演示。</p>
      ) : (
        <div className="worker-grid">
          {snap.workers.map((w) => {
            const thread = snap.threads.find((t) => t.id === w.threadId);
            return (
              <article
                key={w.id}
                className={`worker-card status-${w.status}`}
              >
                <header>
                  <strong>{w.name}</strong>
                  <span className={`status-pill ${w.status}`}>
                    {STATUS_LABEL[w.status] ?? w.status}
                  </span>
                </header>
                <div className="progress">
                  <div style={{ width: `${w.progress}%` }} />
                </div>
                <p className="muted small">
                  Thread: {thread?.key ?? '—'} · 订阅直达{' '}
                  {thread?.subscribedWorkerId === w.id ? '✓' : '—'}
                </p>
                <ul className="worker-log">
                  {w.log.slice(-4).map((line, i) => (
                    <li key={`${w.id}-log-${i}`}>{line}</li>
                  ))}
                </ul>
                {w.pendingHumanAsk ? (
                  <div className="human-ask">
                    <p>{w.pendingHumanAsk}</p>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() =>
                          engine.answerHuman(w.id, '周二 14:00')
                        }
                      >
                        周二 14:00
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          engine.answerHuman(w.id, '周三 10:00')
                        }
                      >
                        周三 10:00
                      </button>
                    </div>
                  </div>
                ) : null}
                {w.resultSummary ? (
                  <p className="result">{w.resultSummary}</p>
                ) : null}
                <div className="btn-row">
                  {w.status === 'running' ? (
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => engine.forceStall(w.id)}
                    >
                      模拟空转
                    </button>
                  ) : null}
                  {w.status === 'stalled' ? (
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => engine.resumeStalled(w.id)}
                    >
                      恢复 Worker
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {snap.watchdogFindings.length > 0 ? (
        <div className="watchdog-box">
          <h3>Watchdog</h3>
          <ul>
            {snap.watchdogFindings.slice(-5).map((f) => (
              <li key={f.id} className={f.resolved ? 'resolved' : 'open'}>
                {f.resolved ? '✓' : '!'} {f.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
