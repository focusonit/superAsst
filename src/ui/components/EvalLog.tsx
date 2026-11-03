import { useEngine } from '../../hooks/useEngine';

export function EvalLog() {
  const snap = useEngine();
  const recent = snap.evals.slice(-8).reverse();
  return (
    <section className="panel compact">
      <header className="panel-head">
        <h2>Eval 记录</h2>
        <span className="muted">Router 研判</span>
      </header>
      {recent.length === 0 ? (
        <p className="empty">尚无评估</p>
      ) : (
        <ul className="eval-list">
          {recent.map((e) => (
            <li key={`${e.triggerId}-${e.action}`}>
              <span className={`action ${e.action}`}>{e.action}</span>
              <span className="backend">{e.backend ?? 'rules'}</span>
              <span>{e.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
