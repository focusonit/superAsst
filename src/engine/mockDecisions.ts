import { matchRules } from '../domain/rules';
import type { AcceptMode, EvalResult, Trigger, Worker } from '../domain/types';

/** Deterministic mock: no LLM. */
export function evaluateTrigger(
  trigger: Trigger,
  mode: AcceptMode,
  hasSubscribedWorker: boolean,
): EvalResult {
  const matched = matchRules(trigger);
  const wouldAccept = matched.length > 0;

  if (mode === 'off') {
    return {
      triggerId: trigger.id,
      wouldAccept,
      reason: '接单模式 = off：不评估、不接单',
      matchedRuleIds: matched.map((m) => m.id),
      mode,
      action: 'ignored',
    };
  }

  if (hasSubscribedWorker) {
    return {
      triggerId: trigger.id,
      wouldAccept: true,
      reason: 'Thread 已有订阅 Worker → 直达交付（旁路 Router 研判）',
      matchedRuleIds: matched.map((m) => m.id),
      mode,
      action: 'routed_to_worker',
    };
  }

  if (!wouldAccept) {
    return {
      triggerId: trigger.id,
      wouldAccept: false,
      reason: '未命中任何接单规则 → 安静忽略',
      matchedRuleIds: [],
      mode,
      action: mode === 'observe' ? 'observed' : 'ignored',
    };
  }

  if (mode === 'observe') {
    return {
      triggerId: trigger.id,
      wouldAccept: true,
      reason: `observe：本来会接（命中 ${matched.map((m) => m.label).join('、')}），仅记录不执行`,
      matchedRuleIds: matched.map((m) => m.id),
      mode,
      action: 'observed',
    };
  }

  return {
    triggerId: trigger.id,
    wouldAccept: true,
    reason: `auto：命中 ${matched.map((m) => m.label).join('、')} → 创建 Ticket`,
    matchedRuleIds: matched.map((m) => m.id),
    mode,
    action: 'ticket_created',
  };
}

/** Deterministic worker step outcomes by ticket title keywords. */
export function mockWorkerStep(worker: Worker, step: number): {
  progress: number;
  log: string;
  askHuman: string | null;
  done: boolean;
  summary: string | null;
} {
  const title = worker.name;
  if (step === 1) {
    return {
      progress: 25,
      log: `收集上下文：${title}`,
      askHuman: null,
      done: false,
      summary: null,
    };
  }
  if (step === 2) {
    const needsAsk =
      title.includes('改期') ||
      title.includes('冲突') ||
      title.includes('reschedule') ||
      title.includes('conflict');
    return {
      progress: 55,
      log: needsAsk ? '发现时间冲突，需要你确认偏好时段' : '草拟方案中…',
      askHuman: needsAsk
        ? '周二 14:00 还是周三 10:00？请选一个。'
        : null,
      done: false,
      summary: null,
    };
  }
  if (step === 3) {
    return {
      progress: 85,
      log: '生成交付草稿',
      askHuman: null,
      done: false,
      summary: null,
    };
  }
  return {
    progress: 100,
    log: '完成并回传 Router',
    askHuman: null,
    done: true,
    summary: `已完成「${title}」：草稿就绪，可审阅后发送。`,
  };
}
