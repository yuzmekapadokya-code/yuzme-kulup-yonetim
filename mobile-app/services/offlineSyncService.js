import { useOfflineQueueStore } from '../store/offlineQueueStore';
import { performQueuedOperation } from './resourceService';

export async function enqueueOfflineJob(job) {
  useOfflineQueueStore.getState().addJob({
    ...job,
    queuedAt: new Date().toISOString(),
  });
}

export async function flushOfflineQueue() {
  const queue = [...useOfflineQueueStore.getState().queue];

  if (!queue.length) {
    return;
  }

  const remaining = [];

  for (const job of queue) {
    try {
      await performQueuedOperation(job);
    } catch (error) {
      remaining.push(job);
      console.warn('Offline job still pending:', error.message);
    }
  }

  useOfflineQueueStore.getState().replaceQueue(remaining);
}