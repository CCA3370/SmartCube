import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import { reducer, initialState, type AppState, type AppEvent } from './machine';
import { SolverClient, createSolverClient } from '../lib/solver/client';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppEvent>;
  solver: SolverClient;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const solverRef = useRef<SolverClient | null>(null);
  if (!solverRef.current) {
    solverRef.current = createSolverClient();
  }

  // Begin building the solver's lookup tables immediately, so they're ready by
  // the time the user finishes scanning.
  useEffect(() => {
    const solver = solverRef.current!;
    let cancelled = false;
    solver
      .init()
      .then(() => {
        if (!cancelled) dispatch({ type: 'SOLVER_READY' });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => solverRef.current?.dispose();
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, solver: solverRef.current }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
