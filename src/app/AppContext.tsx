import { createContext, useContext, useEffect, useReducer, useRef, useCallback, type ReactNode } from 'react';
import { reducer, initialState, type AppState, type AppEvent } from './machine';
import { SolverClient, createSolverClient } from '../lib/solver/client';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppEvent>;
  solver: SolverClient;
  retrySolverInit: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const solverRef = useRef<SolverClient | null>(null);
  if (!solverRef.current) {
    solverRef.current = createSolverClient();
  }

  // Begin building the solver's lookup tables immediately, so they're ready by
  // the time the user finishes scanning. Forward progress to the reducer and
  // surface any init failure (instead of silently swallowing it).
  useEffect(() => {
    const solver = solverRef.current!;
    let cancelled = false;

    // Forward progress updates to the reducer for the progress bar.
    const unsubProgress = solver.onProgress((progress) => {
      if (!cancelled) dispatch({ type: 'SOLVER_PROGRESS', progress });
    });

    solver
      .init()
      .then(() => {
        if (!cancelled) dispatch({ type: 'SOLVER_READY' });
      })
      .catch((e) => {
        if (!cancelled) {
          dispatch({ type: 'SOLVER_ERROR', message: e instanceof Error ? e.message : String(e) });
        }
      });

    return () => {
      cancelled = true;
      unsubProgress();
    };
  }, []);

  useEffect(() => {
    return () => solverRef.current?.dispose();
  }, []);

  const retrySolverInit = useCallback(() => {
    const solver = solverRef.current!;
    dispatch({ type: 'SOLVER_RETRY' });
    solver
      .init()
      .then(() => dispatch({ type: 'SOLVER_READY' }))
      .catch((e) => {
        dispatch({ type: 'SOLVER_ERROR', message: e instanceof Error ? e.message : String(e) });
      });
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, solver: solverRef.current, retrySolverInit }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
