import { useSyncExternalStore } from 'react';

export type Store<T extends object> = {
    get: () => T;
    set: (update: Partial<T> | ((state: T) => Partial<T>)) => void;
    subscribe: (listener: () => void) => () => void;
    reset: () => void;
};

/**
 * Minimal module-level store. State lives outside React components, so a
 * workspace keeps its uploads while the user navigates to other pages.
 * It is cleared on full page reload, which keeps workbook data in memory only.
 */
export function createStore<T extends object>(initial: T): Store<T> {
    let state = initial;
    const listeners = new Set<() => void>();
    const emit = () => listeners.forEach((listener) => listener());

    return {
        get: () => state,
        set: (update) => {
            const patch = typeof update === 'function' ? update(state) : update;
            state = { ...state, ...patch };
            emit();
        },
        subscribe: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        reset: () => {
            state = initial;
            emit();
        },
    };
}

export function useStore<T extends object>(store: Store<T>): T {
    return useSyncExternalStore(store.subscribe, store.get, store.get);
}
