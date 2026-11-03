import type { Source } from './types';

export const DEFAULT_SOURCES: Source[] = [
  { id: 'src-email', kind: 'email', label: '邮件 Email' },
  { id: 'src-calendar', kind: 'calendar', label: '日历 Calendar' },
  { id: 'src-im', kind: 'im', label: '即时消息 IM' },
  { id: 'src-todo', kind: 'todo', label: '待办 Todo' },
];
