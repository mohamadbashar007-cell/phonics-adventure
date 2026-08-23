import { useEffect, useRef } from 'react';
import { useProgressStore } from './store';
import { trpc } from './trpc';

const SYNC_DEBOUNCE_MS = 750;
const INITIAL_HYDRATION_GRACE_MS = 2_000;

/**
 * Sync only progress that changes while the current GroupView is open.
 *
 * The mutation hook returns a new result object while requests are pending. If
 * that object is an effect dependency, each pending-state render schedules the
 * whole progress array again before the previous requests can finish. Keeping
 * the mutation in a ref and marking versions as pending before sending avoids
 * that request loop.
 */
export function useProgressSync() {
  const userId = useProgressStore((state) => state.userId);
  const isAuthenticated = useProgressStore((state) => state.isAuthenticated);
  const allUnlocked = useProgressStore((state) => state.allUnlocked);
  const progress = useProgressStore((state) => state.progress);
  const saveProgressMutation = trpc.saveProgress.useMutation();

  const mutateRef = useRef(saveProgressMutation.mutate);
  const syncedStarsRef = useRef<Map<string, number>>(new Map());
  const pendingStarsRef = useRef<Map<string, number>>(new Map());
  const sessionUserRef = useRef<number | null>(null);
  const hydrationGraceUntilRef = useRef(0);
  const syncTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  mutateRef.current = saveProgressMutation.mutate;

  useEffect(() => {
    const clearScheduledSync = () => {
      if (syncTimeoutRef.current !== null) {
        globalThis.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };

    clearScheduledSync();

    if (!isAuthenticated || !userId) {
      sessionUserRef.current = null;
      syncedStarsRef.current.clear();
      pendingStarsRef.current.clear();
      hydrationGraceUntilRef.current = 0;
      return clearScheduledSync;
    }

    const rememberCurrentProgress = () => {
      progress.forEach((item) => {
        syncedStarsRef.current.set(`${item.groupId}-${item.letterId}`, item.stars);
      });
    };

    if (sessionUserRef.current !== userId) {
      sessionUserRef.current = userId;
      syncedStarsRef.current.clear();
      pendingStarsRef.current.clear();
      hydrationGraceUntilRef.current = Date.now() + INITIAL_HYDRATION_GRACE_MS;
      rememberCurrentProgress();
      return clearScheduledSync;
    }

    // The developer/all-unlocked account is pre-seeded by the server. Sending
    // its entire completed curriculum back on every Group page is unnecessary.
    if (allUnlocked || Date.now() < hydrationGraceUntilRef.current) {
      rememberCurrentProgress();
      return clearScheduledSync;
    }

    const changedItems = progress.filter((item) => {
      if (item.stars <= 0) return false;
      const key = `${item.groupId}-${item.letterId}`;
      return syncedStarsRef.current.get(key) !== item.stars
        && pendingStarsRef.current.get(key) !== item.stars;
    });

    if (changedItems.length === 0) return clearScheduledSync;

    syncTimeoutRef.current = globalThis.setTimeout(() => {
      syncTimeoutRef.current = null;

      changedItems.forEach((item) => {
        const key = `${item.groupId}-${item.letterId}`;
        if (
          syncedStarsRef.current.get(key) === item.stars
          || pendingStarsRef.current.get(key) === item.stars
        ) {
          return;
        }

        // Mark the exact version before starting the request. Pending-state
        // renders can no longer enqueue this same lesson again.
        pendingStarsRef.current.set(key, item.stars);
        mutateRef.current(
          {
            userId,
            groupId: item.groupId,
            letterId: item.letterId,
            stars: item.stars,
          },
          {
            onSuccess: () => {
              syncedStarsRef.current.set(key, item.stars);
            },
            onError: (error) => {
              console.error('Failed to save progress:', error);
            },
            onSettled: () => {
              if (pendingStarsRef.current.get(key) === item.stars) {
                pendingStarsRef.current.delete(key);
              }
            },
          },
        );
      });
    }, SYNC_DEBOUNCE_MS);

    return clearScheduledSync;
  }, [allUnlocked, isAuthenticated, progress, userId]);

  return {
    isSyncing: saveProgressMutation.isPending,
    syncError: saveProgressMutation.error,
  };
}
