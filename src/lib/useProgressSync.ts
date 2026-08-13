import { useEffect, useRef } from 'react';
import { useProgressStore } from './store';
import { trpc } from './trpc';

/**
 * Custom hook to sync progress with backend when user is authenticated
 * Optimized to avoid redundant API calls by tracking synced items
 */
export function useProgressSync() {
  const userId = useProgressStore((state) => state.userId);
  const isAuthenticated = useProgressStore((state) => state.isAuthenticated);
  const progress = useProgressStore((state) => state.progress);
  const saveProgressMutation = trpc.saveProgress.useMutation();
  
  // Track which items have been synced to avoid redundant calls
  const syncedItemsRef = useRef<Set<string>>(new Set());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      syncedItemsRef.current.clear();
      return;
    }

    // Clear previous timeout to debounce rapid changes
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce sync to avoid too many rapid API calls (500ms)
    syncTimeoutRef.current = setTimeout(() => {
      // Only sync items that haven't been synced yet or have changed
      progress.forEach((item) => {
        if (item.stars > 0) {
          const itemKey = `${item.groupId}-${item.letterId}`;
          const existingSyncKey = syncedItemsRef.current.has(itemKey);
          
          // Check if this is a new item or has been updated (by checking stored stars)
          const hasChanged = !existingSyncKey || 
            (existingSyncKey && syncedItemsRef.current.has(`${itemKey}:${item.stars}`) === false);
          
          if (hasChanged) {
            saveProgressMutation.mutate(
              {
                userId,
                groupId: item.groupId,
                letterId: item.letterId,
                stars: item.stars,
              },
              {
                onSuccess: () => {
                  // Mark this item as synced with its current stars value
                  syncedItemsRef.current.add(itemKey);
                  syncedItemsRef.current.add(`${itemKey}:${item.stars}`);
                },
                onError: (error) => {
                  console.error('Failed to save progress:', error);
                },
              }
            );
          }
        }
      });
    }, 500);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [progress, isAuthenticated, userId, saveProgressMutation]);

  return {
    isSyncing: saveProgressMutation.isPending,
    syncError: saveProgressMutation.error,
  };
}
