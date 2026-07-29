import { useSyncExternalStore } from 'react';

interface MediaQueryStore {
  getSnapshot: () => boolean;
  subscribe: (listener: () => void) => () => void;
}

const stores = new Map<string, MediaQueryStore>();
const noopSubscribe = () => () => {};

const getMediaQueryStore = (query: string): MediaQueryStore => {
  const cachedStore = stores.get(query);
  if (cachedStore) return cachedStore;

  const mediaQuery = window.matchMedia(query);
  const listeners = new Set<() => void>();
  const handleChange = () => listeners.forEach((listener) => listener());

  const store: MediaQueryStore = {
    getSnapshot: () => mediaQuery.matches,
    subscribe: (listener) => {
      if (listeners.size === 0) {
        mediaQuery.addEventListener('change', handleChange);
      }
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          mediaQuery.removeEventListener('change', handleChange);
        }
      };
    },
  };

  stores.set(query, store);
  return store;
};

export const useMediaQuery = (query: string, initialValue = false) => {
  const store = typeof window === 'undefined' ? null : getMediaQueryStore(query);

  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? (() => initialValue),
    () => initialValue,
  );
};
