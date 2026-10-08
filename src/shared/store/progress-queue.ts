import { create } from 'zustand';

import {
  sendProgress,
  type ProgressUpdate,
} from '@/shared/services/progressApi';

const keyOf = (update: ProgressUpdate): string =>
  `${update.itemType}:${update.refId}`;

type ProgressQueueState = {
  queue: ProgressUpdate[];
  enqueue: (update: ProgressUpdate) => void;
  flush: () => Promise<void>;
};

export const useProgressQueueStore = create<ProgressQueueState>((set, get) => {
  let flushing = false;
  let flushScheduled = false;

  const scheduleFlush = () => {
    if (flushing) {
      flushScheduled = true;
      return;
    }
    void get().flush();
  };

  return {
    queue: [],

    enqueue: (update) => {
      set((state) => {
        const existing = state.queue.find((u) => keyOf(u) === keyOf(update));
        if (existing) {
          const existingWins =
            existing.lastUpdated > update.lastUpdated ||
            (existing.lastUpdated === update.lastUpdated &&
              existing.completedPct >= update.completedPct &&
              update.completedPct !== 100);
          if (existingWins) {
            return state;
          }
        }
        return {
          queue: [
            ...state.queue.filter((u) => keyOf(u) !== keyOf(update)),
            update,
          ],
        };
      });
      scheduleFlush();
    },

    flush: async () => {
      if (flushing) {
        flushScheduled = true;
        return;
      }
      const { queue } = get();
      if (queue.length === 0) {
        return;
      }
      flushing = true;
      try {
        const snapshot = [...queue];
        await sendProgress(snapshot);
        set((state) => ({
          queue: state.queue.filter(
            (u) => !snapshot.some((s) => keyOf(s) === keyOf(u) && s.lastUpdated === u.lastUpdated),
          ),
        }));
      } catch {
        // Sin conexión u error transitorio: la cola se conserva para el próximo flush.
      } finally {
        flushing = false;
        if (flushScheduled) {
          flushScheduled = false;
          if (get().queue.length > 0) {
            void get().flush();
          }
        }
      }
    },
  };
});
