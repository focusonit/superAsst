import { useEffect, useRef } from 'react';
import { useEngine } from '../../hooks/useEngine';

function pathBadge(path?: string) {
  if (path === 'direct-subscription') {
    return <span className="badge direct">⚡ 直达订阅</span>;
  }
  if (path === 'via-router') {
    return <span className="badge via">↗ 经 Router</span>;
  }
  return null;
}

export function RouterTimeline() {
  const snap = useEngine();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [snap.routerTimeline.length]);

  return (
    <section className="panel timeline-panel">
      <header className="panel-head">
        <h2>Router 时间线</h2>
        <span className="muted">对人说话 · 分派 · 告警</span>
      </header>
      <ol className="timeline">
        {snap.routerTimeline.map((m) => (
          <li key={m.id} className={`tl-item kind-${m.kind}`}>
            <div className="tl-meta">
              <time>{new Date(m.at).toLocaleTimeString()}</time>
              <span className="kind-tag">{m.kind}</span>
              {pathBadge(m.routingPath)}
            </div>
            <p>{m.text}</p>
          </li>
        ))}
        <div ref={endRef} />
      </ol>
      {snap.evaluating ? (
        <p className="evaluating">正在评估 Trigger…</p>
      ) : null}
    </section>
  );
}
