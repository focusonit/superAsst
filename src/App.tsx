import { AcceptModeControl } from './ui/components/AcceptModeControl';
import { EventInjectors } from './ui/components/EventInjectors';
import { EvalLog } from './ui/components/EvalLog';
import { RouterTimeline } from './ui/components/RouterTimeline';
import { ThreadPanel } from './ui/components/ThreadPanel';
import { WorkerBoard } from './ui/components/WorkerBoard';
import { useEngineBootstrap } from './hooks/useEngine';
import './App.css';

export default function App() {
  useEngineBootstrap();

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>SuperAsst</h1>
          <p className="tagline">
            个人事务 Super-agent 演示台 · Router + Workers · 事件 / 订阅 /
            Watchdog
          </p>
        </div>
        <p className="disclaimer">
          教学演示，受 DeepSeek Super-agent 设计思路启发，
          <strong>与 DeepSeek 无官方关联</strong>。参考{' '}
          <a
            href="https://offloop.org/learn/exploring-deepseek-super-agent-design"
            target="_blank"
            rel="noreferrer"
          >
            设计解读
          </a>{' '}
          ·{' '}
          <a
            href="https://github.com/deepseek-ai/dsh-superagent-prototype"
            target="_blank"
            rel="noreferrer"
          >
            dsh-superagent-prototype
          </a>
        </p>
      </header>

      <div className="layout">
        <aside className="col left">
          <AcceptModeControl />
          <EventInjectors />
          <ThreadPanel />
          <EvalLog />
        </aside>
        <main className="col center">
          <RouterTimeline />
        </main>
        <aside className="col right">
          <WorkerBoard />
        </aside>
      </div>
    </div>
  );
}
