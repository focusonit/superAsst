import { DEFAULT_SOURCES } from '../domain/sources';
import type {
  AcceptMode,
  DecisionBackend,
  EngineSnapshot,
  EvalResult,
  LlmRuntimeStatus,
  RouterMessage,
  Thread,
  Ticket,
  Trigger,
  WatchdogFinding,
  Worker,
  WorkerStatus,
} from '../domain/types';
import {
  EVENT_TEMPLATES,
  materializeTrigger,
  type FakeEventTemplate,
} from './fakeEvents';
import { nextId, resetIds } from './ids';
import {
  evaluateTriggerMaybeLlm,
  fetchLlmStatus,
  llmWorkerAssist,
} from './llm';
import { mockWorkerStep } from './mockDecisions';

type Listener = () => void;

const STALL_MS = 8000;

const defaultLlmStatus: LlmRuntimeStatus = {
  available: false,
  model: null,
  message: '尚未探测 LLM 服务',
};

function emptyState(): EngineSnapshot {
  return {
    acceptMode: 'auto',
    decisionBackend: 'rules',
    llmStatus: defaultLlmStatus,
    sources: DEFAULT_SOURCES,
    triggers: [],
    threads: [],
    tickets: [],
    workers: [],
    routerTimeline: [
      {
        id: nextId('msg'),
        at: Date.now(),
        kind: 'system',
        text: 'Super-agent 演示台就绪。默认离线规则引擎；配置 DEEPSEEK_API_KEY 并启动 API 后可切到 LLM 评估。',
      },
    ],
    evals: [],
    watchdogFindings: [],
    clock: Date.now(),
    demoRunning: false,
    evaluating: false,
  };
}

class EngineStore {
  private state: EngineSnapshot = emptyState();
  private listeners = new Set<Listener>();
  private workerTimers = new Map<string, ReturnType<typeof setInterval>>();
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private workerSteps = new Map<string, number>();
  private ingestQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.startWatchdog();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): EngineSnapshot {
    return this.state;
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  private patch(partial: Partial<EngineSnapshot>): void {
    this.state = { ...this.state, ...partial, clock: Date.now() };
    this.emit();
  }

  private pushMessage(
    msg: Omit<RouterMessage, 'id' | 'at'> & { at?: number },
  ): void {
    const full: RouterMessage = {
      id: nextId('msg'),
      at: msg.at ?? Date.now(),
      kind: msg.kind,
      text: msg.text,
      triggerId: msg.triggerId,
      ticketId: msg.ticketId,
      workerId: msg.workerId,
      routingPath: msg.routingPath,
      meta: msg.meta,
    };
    this.state = {
      ...this.state,
      routerTimeline: [...this.state.routerTimeline, full],
      clock: Date.now(),
    };
  }

  async refreshLlmStatus(): Promise<void> {
    const status = await fetchLlmStatus();
    this.patch({
      llmStatus: {
        available: status.available,
        model: status.model,
        message: status.message,
      },
    });
    if (!status.available && this.state.decisionBackend === 'llm') {
      this.pushMessage({
        kind: 'system',
        text: `LLM 不可用，已保持/建议回退 rules：${status.message}`,
      });
      this.patch({ decisionBackend: 'rules' });
    }
  }

  setAcceptMode(mode: AcceptMode): void {
    this.pushMessage({
      kind: 'system',
      text: `接单模式切换为「${mode}」${
        mode === 'off'
          ? '（不接单）'
          : mode === 'observe'
            ? '（只记录本会接什么）'
            : '（命中规则/LLM 同意才真接）'
      }`,
    });
    this.patch({ acceptMode: mode });
  }

  setDecisionBackend(backend: DecisionBackend): void {
    if (backend === 'llm' && !this.state.llmStatus.available) {
      this.pushMessage({
        kind: 'system',
        text: 'LLM 未就绪（缺 DEEPSEEK_API_KEY 或未启动 server）。仍用 rules；配好后点「刷新 LLM 状态」。',
      });
      this.patch({ decisionBackend: 'rules' });
      return;
    }
    this.pushMessage({
      kind: 'system',
      text:
        backend === 'llm'
          ? '决策后端 → DeepSeek LLM（失败自动回退规则）'
          : '决策后端 → 本地确定性规则（离线可用）',
    });
    this.patch({ decisionBackend: backend });
  }

  reset(): void {
    this.clearTimers();
    resetIds(0);
    this.workerSteps.clear();
    const llmStatus = this.state.llmStatus;
    const decisionBackend =
      this.state.decisionBackend === 'llm' && llmStatus.available
        ? 'llm'
        : 'rules';
    this.state = { ...emptyState(), llmStatus, decisionBackend };
    this.startWatchdog();
    this.emit();
  }

  injectTemplate(key: keyof typeof EVENT_TEMPLATES): void {
    const trigger = materializeTrigger(key, Date.now());
    void this.ingestTriggerAsync(trigger);
  }

  injectCustom(template: FakeEventTemplate): void {
    const trigger: Trigger = {
      id: nextId('trg'),
      sourceId: `src-${template.sourceKind}`,
      sourceKind: template.sourceKind,
      threadKey: template.threadKey,
      title: template.title,
      body: template.body,
      at: Date.now(),
      tags: [...template.tags],
    };
    void this.ingestTriggerAsync(trigger);
  }

  /** Serialize ingests so demo scenario ordering stays stable. */
  ingestTriggerAsync(trigger: Trigger): Promise<void> {
    this.ingestQueue = this.ingestQueue
      .then(() => this.ingestTrigger(trigger))
      .catch((err) => {
        this.pushMessage({
          kind: 'system',
          text: `ingest 失败: ${err instanceof Error ? err.message : String(err)}`,
        });
        this.emit();
      });
    return this.ingestQueue;
  }

  /** Core Router path: Trigger → Thread → Eval → Ticket/Worker or ignore */
  private async ingestTrigger(trigger: Trigger): Promise<void> {
    const triggers = [...this.state.triggers, trigger];
    let thread = this.state.threads.find((t) => t.key === trigger.threadKey);
    let threads = this.state.threads;

    if (!thread) {
      thread = {
        id: nextId('thr'),
        key: trigger.threadKey,
        sourceKind: trigger.sourceKind,
        title: trigger.title,
        triggerIds: [trigger.id],
        subscribedWorkerId: null,
        createdAt: trigger.at,
        updatedAt: trigger.at,
      };
      threads = [...threads, thread];
    } else {
      thread = {
        ...thread,
        triggerIds: [...thread.triggerIds, trigger.id],
        updatedAt: trigger.at,
      };
      threads = threads.map((t) => (t.id === thread!.id ? thread! : t));
    }

    this.state = {
      ...this.state,
      triggers,
      threads,
      evaluating: true,
      clock: Date.now(),
    };
    this.pushMessage({
      kind: 'inbound',
      text: `[${trigger.sourceKind}] ${trigger.title}`,
      triggerId: trigger.id,
      meta: { threadKey: trigger.threadKey },
    });
    this.emit();

    const hasSub = Boolean(thread.subscribedWorkerId);
    const evalResult = await evaluateTriggerMaybeLlm(
      trigger,
      this.state.acceptMode,
      hasSub,
      this.state.decisionBackend,
    );

    this.state = {
      ...this.state,
      evals: [...this.state.evals, evalResult],
      evaluating: false,
    };

    const backendTag = evalResult.backend === 'llm' ? 'LLM' : '规则';

    if (evalResult.action === 'routed_to_worker' && thread.subscribedWorkerId) {
      this.deliverDirect(trigger, thread, evalResult);
      this.emit();
      return;
    }

    if (evalResult.action === 'observed') {
      this.pushMessage({
        kind: 'observe',
        text: `👀 Observe[${backendTag}]：${evalResult.reason}`,
        triggerId: trigger.id,
        routingPath: 'via-router',
      });
      this.emit();
      return;
    }

    if (evalResult.action === 'ignored') {
      this.pushMessage({
        kind: 'system',
        text: `🤫 [${backendTag}] ${evalResult.reason}`,
        triggerId: trigger.id,
        routingPath: 'via-router',
      });
      this.emit();
      return;
    }

    if (evalResult.action === 'ticket_created') {
      this.createTicketAndWorker(trigger, thread, evalResult);
    }

    this.emit();
  }

  private deliverDirect(
    trigger: Trigger,
    thread: Thread,
    evalResult: EvalResult,
  ): void {
    const workerId = thread.subscribedWorkerId!;
    const worker = this.state.workers.find((w) => w.id === workerId);
    if (!worker) return;

    const updated: Worker = {
      ...worker,
      status:
        worker.status === 'done'
          ? 'running'
          : worker.status === 'waiting_human'
            ? 'waiting_human'
            : 'running',
      lastHeartbeatAt: Date.now(),
      log: [...worker.log, `📩 直达订阅：${trigger.title}`],
      progress: Math.min(worker.progress, 90),
    };

    this.state = {
      ...this.state,
      workers: this.state.workers.map((w) => (w.id === workerId ? updated : w)),
    };

    this.pushMessage({
      kind: 'dispatch',
      text: `⚡ 直达订阅 Worker「${worker.name}」← ${trigger.title}`,
      triggerId: trigger.id,
      workerId,
      routingPath: 'direct-subscription',
      meta: { eval: evalResult.reason },
    });

    if (!this.workerTimers.has(workerId) && updated.status === 'running') {
      this.workerSteps.set(workerId, this.workerSteps.get(workerId) ?? 1);
      this.scheduleWorkerTicks(workerId);
    }
  }

  private createTicketAndWorker(
    trigger: Trigger,
    thread: Thread,
    evalResult: EvalResult,
  ): void {
    const ticket: Ticket = {
      id: nextId('tkt'),
      threadId: thread.id,
      triggerId: trigger.id,
      title: trigger.title,
      status: 'accepted',
      createdAt: Date.now(),
      workerId: null,
      evalReason: evalResult.reason,
    };

    const worker: Worker = {
      id: nextId('wrk'),
      name: trigger.title,
      ticketId: ticket.id,
      threadId: thread.id,
      status: 'running',
      progress: 0,
      lastHeartbeatAt: Date.now(),
      log: [`Ticket 受理：${evalResult.reason}`],
      pendingHumanAsk: null,
      resultSummary: null,
      createdAt: Date.now(),
    };

    ticket.workerId = worker.id;
    ticket.status = 'assigned';

    const updatedThread: Thread = {
      ...thread,
      subscribedWorkerId: worker.id,
    };

    this.state = {
      ...this.state,
      tickets: [...this.state.tickets, ticket],
      workers: [...this.state.workers, worker],
      threads: this.state.threads.map((t) =>
        t.id === thread.id ? updatedThread : t,
      ),
    };

    this.pushMessage({
      kind: 'dispatch',
      text: `🚀 Router 分派 Worker ← ${trigger.title}`,
      triggerId: trigger.id,
      ticketId: ticket.id,
      workerId: worker.id,
      routingPath: 'via-router',
      meta: { eval: evalResult.reason },
    });

    this.pushMessage({
      kind: 'router_reply',
      text: `好的，我来处理「${trigger.title.slice(0, 24)}${trigger.title.length > 24 ? '…' : ''}」。有进展再找你。`,
      triggerId: trigger.id,
      workerId: worker.id,
      routingPath: 'via-router',
    });

    this.workerSteps.set(worker.id, 0);
    this.scheduleWorkerTicks(worker.id);
  }

  private scheduleWorkerTicks(workerId: string): void {
    if (this.workerTimers.has(workerId)) return;
    const timer = setInterval(() => {
      void this.tickWorker(workerId);
    }, 1600);
    this.workerTimers.set(workerId, timer);
  }

  private async tickWorker(workerId: string): Promise<void> {
    const worker = this.state.workers.find((w) => w.id === workerId);
    if (!worker) {
      this.clearWorkerTimer(workerId);
      return;
    }
    if (worker.status === 'waiting_human' || worker.status === 'stalled') {
      return;
    }
    if (worker.status === 'done' || worker.status === 'cancelled') {
      this.clearWorkerTimer(workerId);
      return;
    }

    const step = (this.workerSteps.get(workerId) ?? 0) + 1;
    this.workerSteps.set(workerId, step);
    const outcome = mockWorkerStep(worker, step);

    let status: WorkerStatus = worker.status;
    let pendingHumanAsk = worker.pendingHumanAsk;
    let resultSummary = worker.resultSummary;
    const log = [...worker.log, outcome.log];

    // Optional LLM polish on final summary
    if (outcome.done && this.state.decisionBackend === 'llm') {
      const assisted = await llmWorkerAssist({
        taskTitle: worker.name,
        context: worker.log.slice(-5).join('\n'),
        step: 'final_summary',
      });
      if (assisted) {
        outcome.summary = assisted;
        log.push(`LLM 润色交付：${assisted.slice(0, 80)}…`);
      }
    }

    if (outcome.askHuman) {
      status = 'waiting_human';
      pendingHumanAsk = outcome.askHuman;
      this.pushMessage({
        kind: 'human_ask',
        text: `❓ Worker 请示：${outcome.askHuman}`,
        workerId,
        ticketId: worker.ticketId,
        routingPath: 'via-router',
      });
      this.updateTicketStatus(worker.ticketId, 'waiting_human');
    } else if (outcome.done) {
      status = 'done';
      resultSummary = outcome.summary;
      this.pushMessage({
        kind: 'worker_report',
        text: `✅ ${outcome.summary}`,
        workerId,
        ticketId: worker.ticketId,
        routingPath: 'via-router',
      });
      this.updateTicketStatus(worker.ticketId, 'done');
      this.clearWorkerTimer(workerId);
    } else {
      status = 'running';
      this.updateTicketStatus(worker.ticketId, 'in_progress');
    }

    this.state = {
      ...this.state,
      workers: this.state.workers.map((w) =>
        w.id === workerId
          ? {
              ...w,
              status,
              progress: outcome.progress,
              lastHeartbeatAt: Date.now(),
              log,
              pendingHumanAsk,
              resultSummary,
            }
          : w,
      ),
      clock: Date.now(),
    };
    this.emit();
  }

  private updateTicketStatus(ticketId: string, status: Ticket['status']): void {
    this.state = {
      ...this.state,
      tickets: this.state.tickets.map((t) =>
        t.id === ticketId ? { ...t, status } : t,
      ),
    };
  }

  answerHuman(workerId: string, answer: string): void {
    const worker = this.state.workers.find((w) => w.id === workerId);
    if (!worker || worker.status !== 'waiting_human') return;

    const updated: Worker = {
      ...worker,
      status: 'running',
      pendingHumanAsk: null,
      lastHeartbeatAt: Date.now(),
      log: [...worker.log, `👤 你的答复：${answer}`],
    };

    this.state = {
      ...this.state,
      workers: this.state.workers.map((w) => (w.id === workerId ? updated : w)),
    };
    this.updateTicketStatus(worker.ticketId, 'in_progress');
    this.pushMessage({
      kind: 'inbound',
      text: `你回复 Worker：${answer}`,
      workerId,
    });
    this.pushMessage({
      kind: 'router_reply',
      text: '收到，继续处理。',
      workerId,
    });
    this.emit();
    this.scheduleWorkerTicks(workerId);
  }

  forceStall(workerId: string): void {
    this.clearWorkerTimer(workerId);
    this.state = {
      ...this.state,
      workers: this.state.workers.map((w) =>
        w.id === workerId
          ? {
              ...w,
              status: 'running',
              lastHeartbeatAt: Date.now() - STALL_MS - 1000,
              log: [...w.log, '⚠️ （演示）人为制造空转，等待 Watchdog…'],
            }
          : w,
      ),
    };
    this.emit();
    this.runWatchdogPass();
  }

  private startWatchdog(): void {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(() => this.runWatchdogPass(), 2000);
  }

  private runWatchdogPass(): void {
    const now = Date.now();
    const findings: WatchdogFinding[] = [...this.state.watchdogFindings];
    let workers = this.state.workers;
    let changed = false;

    for (const w of workers) {
      if (w.status !== 'running') continue;
      const silent = now - w.lastHeartbeatAt;
      if (silent < STALL_MS) continue;

      const already = findings.some(
        (f) => f.workerId === w.id && !f.resolved && f.severity === 'critical',
      );
      if (already) continue;

      changed = true;
      workers = workers.map((x) =>
        x.id === w.id
          ? {
              ...x,
              status: 'stalled' as const,
              log: [...x.log, '🐕 Watchdog：检测到空转，已标红'],
            }
          : x,
      );
      const finding: WatchdogFinding = {
        id: nextId('wd'),
        at: now,
        workerId: w.id,
        severity: 'critical',
        message: `Worker「${w.name}」超过 ${Math.round(silent / 1000)}s 无心跳`,
        resolved: false,
      };
      findings.push(finding);
      this.pushMessage({
        kind: 'watchdog',
        text: `🐕 Watchdog 告警：${finding.message}`,
        workerId: w.id,
      });
    }

    if (changed) {
      this.state = {
        ...this.state,
        workers,
        watchdogFindings: findings,
        clock: now,
      };
      this.emit();
    }
  }

  resumeStalled(workerId: string): void {
    const worker = this.state.workers.find((w) => w.id === workerId);
    if (!worker || worker.status !== 'stalled') return;

    this.state = {
      ...this.state,
      workers: this.state.workers.map((w) =>
        w.id === workerId
          ? {
              ...w,
              status: 'running',
              lastHeartbeatAt: Date.now(),
              log: [...w.log, '▶️ 已从 Watchdog 告警恢复'],
            }
          : w,
      ),
      watchdogFindings: this.state.watchdogFindings.map((f) =>
        f.workerId === workerId && !f.resolved ? { ...f, resolved: true } : f,
      ),
    };
    this.pushMessage({
      kind: 'watchdog',
      text: `Watchdog：Worker「${worker.name}」已恢复`,
      workerId,
    });
    this.emit();
    this.scheduleWorkerTicks(workerId);
  }

  private clearWorkerTimer(workerId: string): void {
    const t = this.workerTimers.get(workerId);
    if (t) clearInterval(t);
    this.workerTimers.delete(workerId);
  }

  private clearTimers(): void {
    this.workerTimers.forEach((t) => clearInterval(t));
    this.workerTimers.clear();
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  setDemoRunning(v: boolean): void {
    this.patch({ demoRunning: v });
  }
}

export const engine = new EngineStore();
