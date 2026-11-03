/**
 * Optional DeepSeek (OpenAI-compatible) client.
 * Browser calls same-origin `/api/llm/*` which the local server proxies.
 * Never put DEEPSEEK_API_KEY in VITE_* — keys stay server-side.
 */

import type { AcceptMode, EvalResult, Trigger } from '../domain/types';
import { ACCEPT_RULES } from '../domain/rules';
import { evaluateTrigger } from './mockDecisions';

export type DecisionBackend = 'rules' | 'llm';

export interface LlmStatus {
  available: boolean;
  model: string | null;
  baseUrlConfigured: boolean;
  message: string;
}

export async function fetchLlmStatus(): Promise<LlmStatus> {
  try {
    const res = await fetch('/api/llm/status');
    if (!res.ok) {
      return {
        available: false,
        model: null,
        baseUrlConfigured: false,
        message: `API status ${res.status} — 使用本地规则引擎`,
      };
    }
    return (await res.json()) as LlmStatus;
  } catch {
    return {
      available: false,
      model: null,
      baseUrlConfigured: false,
      message: '未启动 API 服务或无密钥 — 离线规则模式',
    };
  }
}

interface LlmEvalResponse {
  wouldAccept: boolean;
  reason: string;
  matchedRuleIds: string[];
  raw?: string;
}

/** Try DeepSeek eval; on any failure fall back to deterministic rules. */
export async function evaluateTriggerMaybeLlm(
  trigger: Trigger,
  mode: AcceptMode,
  hasSubscribedWorker: boolean,
  backend: DecisionBackend,
): Promise<EvalResult & { backend: DecisionBackend }> {
  if (hasSubscribedWorker || mode === 'off' || backend !== 'llm') {
    return {
      ...evaluateTrigger(trigger, mode, hasSubscribedWorker),
      backend: 'rules',
    };
  }

  try {
    const res = await fetch('/api/llm/eval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger: {
          sourceKind: trigger.sourceKind,
          title: trigger.title,
          body: trigger.body,
          tags: trigger.tags,
          threadKey: trigger.threadKey,
        },
        rules: ACCEPT_RULES.map((r) => ({ id: r.id, label: r.label })),
        mode,
      }),
    });

    if (!res.ok) {
      const fallback = evaluateTrigger(trigger, mode, hasSubscribedWorker);
      return {
        ...fallback,
        reason: `${fallback.reason}（LLM 不可用 HTTP ${res.status}，已回退规则）`,
        backend: 'rules',
      };
    }

    const data = (await res.json()) as LlmEvalResponse;
    const wouldAccept = Boolean(data.wouldAccept);
    let action: EvalResult['action'] = 'ignored';
    if (mode === 'observe') {
      action = 'observed';
    } else if (mode === 'auto' && wouldAccept) {
      action = 'ticket_created';
    }

    return {
      triggerId: trigger.id,
      wouldAccept,
      reason: data.reason || 'LLM 评估完成',
      matchedRuleIds: data.matchedRuleIds ?? [],
      mode,
      action,
      backend: 'llm',
    };
  } catch (err) {
    const fallback = evaluateTrigger(trigger, mode, hasSubscribedWorker);
    return {
      ...fallback,
      reason: `${fallback.reason}（LLM 错误: ${err instanceof Error ? err.message : 'unknown'}，已回退）`,
      backend: 'rules',
    };
  }
}

export async function llmWorkerAssist(prompt: {
  taskTitle: string;
  context: string;
  step: string;
}): Promise<string | null> {
  try {
    const res = await fetch('/api/llm/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    return data.text ?? null;
  } catch {
    return null;
  }
}
