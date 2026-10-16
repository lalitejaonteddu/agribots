import { useSyncExternalStore } from 'react'

/** Minimal observable store shared between the 3D scene and the DOM UI. */
export function createStore(initial) {
  let state = initial
  const subs = new Set()
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
      subs.forEach((f) => f())
    },
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

/** Subscribe a component to a store. Select primitives (or the whole state) to avoid re-render loops. */
export function useStore(store, select = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => select(store.get()))
}
