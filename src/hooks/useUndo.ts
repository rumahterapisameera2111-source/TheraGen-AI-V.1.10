import { useState, useCallback } from 'react';

export function useUndo<T>(initialPresent: T) {
  const [state, setState] = useState({
    past: [] as T[],
    present: initialPresent,
    future: [] as T[]
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    setState(currentState => {
      if (currentState.past.length === 0) return currentState;
      const previous = currentState.past[currentState.past.length - 1];
      const newPast = currentState.past.slice(0, currentState.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [currentState.present, ...currentState.future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(currentState => {
      if (currentState.future.length === 0) return currentState;
      const next = currentState.future[0];
      const newFuture = currentState.future.slice(1);
      return {
        past: [...currentState.past, currentState.present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  const set = useCallback((newPresent: T) => {
    setState(currentState => {
      if (currentState.present === newPresent) return currentState;
      return {
        past: [...currentState.past, currentState.present],
        present: newPresent,
        future: []
      };
    });
  }, []);

  const reset = useCallback((newPresent: T) => {
    setState({
      past: [],
      present: newPresent,
      future: []
    });
  }, []);

  return { state: state.present, set, undo, redo, reset, canUndo, canRedo };
}
