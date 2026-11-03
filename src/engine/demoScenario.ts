import { materializeTrigger } from './fakeEvents';
import { engine } from './store';

/**
 * Scripted walkthrough that exercises:
 * ignore noise → accept urgent → calendar conflict + human ask →
 * same-thread followup (direct subscription) → optional stall/watchdog.
 */
export async function runDemoScenario(
  onStatus?: (msg: string) => void,
): Promise<void> {
  if (engine.getSnapshot().demoRunning) return;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const say = (m: string) => onStatus?.(m);

  engine.setDemoRunning(true);
  engine.reset();
  // reset clears demoRunning — set again
  engine.setDemoRunning(true);
  engine.setAcceptMode('auto');

  try {
    say('1/6 注入营销邮件（应被安静忽略）');
    await engine.ingestTriggerAsync(
      materializeTrigger('emailNoise', Date.now()),
    );
    await sleep(900);

    say('2/6 注入紧急邮件（应经 Router 分派 Worker）');
    await engine.ingestTriggerAsync(
      materializeTrigger('emailUrgent', Date.now()),
    );
    await sleep(1400);

    say('3/6 注入日历冲突（Worker 会请示你）');
    await engine.ingestTriggerAsync(
      materializeTrigger('calendarConflict', Date.now()),
    );
    await sleep(2200);

    // Auto-answer first waiting worker if any (keep scenario hands-free)
    const waiting = engine
      .getSnapshot()
      .workers.find((w) => w.status === 'waiting_human');
    if (waiting) {
      say('4/6 自动代答人工请示：选周二 14:00');
      engine.answerHuman(waiting.id, '周二 14:00');
      await sleep(1000);
    } else {
      say('4/6 （暂无人请示，跳过）');
      await sleep(400);
    }

    say('5/6 同 Thread 跟进 → 直达订阅 Worker（旁路 Router 研判）');
    await engine.ingestTriggerAsync(
      materializeTrigger('calendarFollowup', Date.now()),
    );
    await sleep(1200);

    say('6/6 注入 IM @提及；随后可选制造空转测 Watchdog');
    await engine.ingestTriggerAsync(
      materializeTrigger('imMention', Date.now()),
    );
    await sleep(1600);

    const running = engine
      .getSnapshot()
      .workers.find((w) => w.status === 'running');
    if (running) {
      say('制造空转 → Watchdog 标红');
      engine.forceStall(running.id);
      await sleep(500);
    }

    say('脚本演示结束。可继续手动注入事件或恢复卡住的 Worker。');
  } finally {
    engine.setDemoRunning(false);
  }
}
