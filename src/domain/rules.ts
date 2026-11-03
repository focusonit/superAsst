import type { AcceptRule, Trigger } from './types';

/** Team-written rules: auto mode only accepts when ≥1 rule matches. */
export const ACCEPT_RULES: AcceptRule[] = [
  {
    id: 'rule-meeting-conflict',
    label: '日历冲突 / 改期请求',
    match: (t: Trigger) =>
      t.sourceKind === 'calendar' &&
      (t.tags.includes('conflict') || t.tags.includes('reschedule')),
  },
  {
    id: 'rule-urgent-email',
    label: '紧急邮件（urgent / deadline）',
    match: (t: Trigger) =>
      t.sourceKind === 'email' &&
      (t.tags.includes('urgent') || t.tags.includes('deadline')),
  },
  {
    id: 'rule-im-mention',
    label: 'IM 被 @ 提及',
    match: (t: Trigger) =>
      t.sourceKind === 'im' && t.tags.includes('mention'),
  },
  {
    id: 'rule-todo-due-soon',
    label: '待办即将到期',
    match: (t: Trigger) =>
      t.sourceKind === 'todo' && t.tags.includes('due-soon'),
  },
  {
    id: 'rule-followup',
    label: '同一 Thread 的后续跟进',
    match: (t: Trigger) => t.tags.includes('followup'),
  },
];

export function matchRules(trigger: Trigger): AcceptRule[] {
  return ACCEPT_RULES.filter((r) => r.match(trigger));
}
