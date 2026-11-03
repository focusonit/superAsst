import { useEngine } from '../../hooks/useEngine';

export function ThreadPanel() {
  const snap = useEngine();
  return (
    <section className="panel compact">
      <header className="panel-head">
        <h2>Threads</h2>
        <span className="muted">订阅 = 后续直达</span>
      </header>
      {snap.threads.length === 0 ? (
        <p className="empty">暂无 Thread</p>
      ) : (
        <ul className="thread-list">
          {snap.threads.map((t) => (
            <li key={t.id}>
              <code>{t.key}</code>
              <span>
                {t.triggerIds.length} triggers · Worker{' '}
                {t.subscribedWorkerId ?? '无'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
