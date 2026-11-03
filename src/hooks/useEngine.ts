import { useEffect, useState, useSyncExternalStore } from 'react';
import type { EngineSnapshot } from '../domain/types';
import { engine } from '../engine/store';

export function useEngine(): EngineSnapshot {
  return useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.getSnapshot(),
    () => engine.getSnapshot(),
  );
}

export function useEngineBootstrap(): void {
  const [done, setDone] = useState(false);
  useEffect(() => {
    void engine.refreshLlmStatus().finally(() => setDone(true));
  }, []);
  void done;
}
