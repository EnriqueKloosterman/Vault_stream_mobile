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

export const useProgressQueueStore = create<ProgressQueueState>((set, get) => ({
  queue: [],

  enqueue: (update) => {
    set((state) => {
      const existing = state.queue.find((u) => keyOf(u) === keyOf(update));
      if (existing && existing.lastUpdated >= update.lastUpdated) {
        return state;
      }
      return {
        queue: [
          ...state.queue.filter((u) => keyOf(u) !== keyOf(update)),
          update,
        ],
      };
    });
    void get().flush();
  },

  flush: async () => {
    const { queue } = get();
    if (queue.length === 0) {
      return;
    }
    try {
      await sendProgress(queue);
      set((state) => ({
        queue: state.queue.filter((u) => !queue.includes(u)),
      }));
    } catch {
      // Sin conexión u error transitorio: la cola se reenvía al reconectar.
    }
  },
}));
