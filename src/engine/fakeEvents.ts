import type { SourceKind, Trigger } from '../domain/types';
import { nextId } from './ids';

export interface FakeEventTemplate {
  sourceKind: SourceKind;
  threadKey: string;
  title: string;
  body: string;
  tags: string[];
}

export const EVENT_TEMPLATES: Record<string, FakeEventTemplate> = {
  emailUrgent: {
    sourceKind: 'email',
    threadKey: 'email:q3-report',
    title: '【紧急】Q3 报告截止今晚',
    body: 'Hi，Q3 汇报材料需要今晚 22:00 前提交，请协助整理要点。',
    tags: ['urgent', 'deadline'],
  },
  emailNoise: {
    sourceKind: 'email',
    threadKey: 'email:newsletter',
    title: '周报精选：行业资讯',
    body: '本周精选文章合集……（营销邮件）',
    tags: ['newsletter'],
  },
  calendarConflict: {
    sourceKind: 'calendar',
    threadKey: 'cal:design-sync',
    title: '设计同步会与 1:1 冲突',
    body: '明天 15:00 设计同步与老板 1:1 重叠，需要改期其一。',
    tags: ['conflict', 'reschedule'],
  },
  calendarFollowup: {
    sourceKind: 'calendar',
    threadKey: 'cal:design-sync',
    title: '改期跟进：对方回复可选时段',
    body: '对方说周二 14:00 或周三 10:00 都可以。',
    tags: ['followup', 'reschedule'],
  },
  imMention: {
    sourceKind: 'im',
    threadKey: 'im:proj-alpha',
    title: '@你：Alpha 发布清单谁来核对？',
    body: '发布窗口周四，麻烦帮忙过一遍 checklist。',
    tags: ['mention'],
  },
  imNoise: {
    sourceKind: 'im',
    threadKey: 'im:watercooler',
    title: '今天食堂有糖醋排骨',
    body: '有人一起去吗？',
    tags: ['chatter'],
  },
  todoDue: {
    sourceKind: 'todo',
    threadKey: 'todo:visa-docs',
    title: '签证材料明天到期',
    body: '待办「准备签证材料」截止明日 12:00。',
    tags: ['due-soon'],
  },
};

export function materializeTrigger(
  templateKey: keyof typeof EVENT_TEMPLATES,
  at: number,
): Trigger {
  const t = EVENT_TEMPLATES[templateKey];
  return {
    id: nextId('trg'),
    sourceId: `src-${t.sourceKind}`,
    sourceKind: t.sourceKind,
    threadKey: t.threadKey,
    title: t.title,
    body: t.body,
    at,
    tags: [...t.tags],
  };
}

export function listInjectorButtons(): {
  key: keyof typeof EVENT_TEMPLATES;
  label: string;
  sourceKind: SourceKind;
}[] {
  return [
    { key: 'emailUrgent', label: '注入：紧急邮件', sourceKind: 'email' },
    { key: 'emailNoise', label: '注入：营销邮件（应忽略）', sourceKind: 'email' },
    {
      key: 'calendarConflict',
      label: '注入：日历冲突',
      sourceKind: 'calendar',
    },
    {
      key: 'calendarFollowup',
      label: '注入：同 Thread 跟进（测直达）',
      sourceKind: 'calendar',
    },
    { key: 'imMention', label: '注入：IM @提及', sourceKind: 'im' },
    { key: 'imNoise', label: '注入：闲聊（应忽略）', sourceKind: 'im' },
    { key: 'todoDue', label: '注入：待办到期', sourceKind: 'todo' },
  ];
}
