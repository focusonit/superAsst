/** Domain types inspired by DeepSeek Super-agent design (educational demo). */

export type SourceKind = 'email' | 'calendar' | 'im' | 'todo';

export type AcceptMode = 'off' | 'observe' | 'auto';

export type DecisionBackend = 'rules' | 'llm';

export type RoutingPath = 'via-router' | 'direct-subscription';

export type WorkerStatus =
  | 'idle'
  | 'running'
  | 'waiting_human'
  | 'ready'
  | 'stalled'
  | 'done'
  | 'cancelled';

export type TicketStatus =
  | 'proposed'
  | 'observed'
  | 'accepted'
  | 'assigned'
  | 'in_progress'
  | 'waiting_human'
  | 'done'
  | 'rejected';

export interface Source {
  id: string;
  kind: SourceKind;
  label: string;
}

export interface Trigger {
  id: string;
  sourceId: string;
  sourceKind: SourceKind;
  threadKey: string;
  title: string;
  body: string;
  at: number;
  /** Deterministic tags used by mock eval rules */
  tags: string[];
}

export interface Thread {
  id: string;
  key: string;
  sourceKind: SourceKind;
  title: string;
  triggerIds: string[];
  /** Worker id subscribed to this thread (direct delivery) */
  subscribedWorkerId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface EvalResult {
  triggerId: string;
  wouldAccept: boolean;
  reason: string;
  matchedRuleIds: string[];
  mode: AcceptMode;
  /** In observe: recorded only. In auto: may create ticket. */
  action: 'ignored' | 'observed' | 'ticket_created' | 'routed_to_worker';
  backend?: DecisionBackend;
}

export interface Ticket {
  id: string;
  threadId: string;
  triggerId: string;
  title: string;
  status: TicketStatus;
  createdAt: number;
  workerId: string | null;
  evalReason: string;
}

export interface Worker {
  id: string;
  name: string;
  ticketId: string;
  threadId: string;
  status: WorkerStatus;
  progress: number;
  lastHeartbeatAt: number;
  log: string[];
  /** Short reply destined for the human via Router */
  pendingHumanAsk: string | null;
  resultSummary: string | null;
  createdAt: number;
}

export interface RouterMessage {
  id: string;
  at: number;
  kind:
    | 'inbound'
    | 'router_reply'
    | 'dispatch'
    | 'worker_report'
    | 'human_ask'
    | 'system'
    | 'observe'
    | 'watchdog';
  text: string;
  triggerId?: string;
  ticketId?: string;
  workerId?: string;
  routingPath?: RoutingPath;
  meta?: Record<string, string>;
}

export interface WatchdogFinding {
  id: string;
  at: number;
  workerId: string;
  severity: 'info' | 'warn' | 'critical';
  message: string;
  resolved: boolean;
}

export interface AcceptRule {
  id: string;
  label: string;
  /** Return true if trigger matches this rule */
  match: (t: Trigger) => boolean;
}

export interface LlmRuntimeStatus {
  available: boolean;
  model: string | null;
  message: string;
}

export interface EngineSnapshot {
  acceptMode: AcceptMode;
  decisionBackend: DecisionBackend;
  llmStatus: LlmRuntimeStatus;
  sources: Source[];
  triggers: Trigger[];
  threads: Thread[];
  tickets: Ticket[];
  workers: Worker[];
  routerTimeline: RouterMessage[];
  evals: EvalResult[];
  watchdogFindings: WatchdogFinding[];
  clock: number;
  demoRunning: boolean;
  evaluating: boolean;
}
