import { createContext, createElement, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { HABITATS, type HabitatId } from '../model/habitats';

export type Conditions = { o2: number; pressure: number; flow: number; gravity: number };

export type StoreState = Conditions & {
  habitat: HabitatId;
  step: number;
  compare: [string | null, string | null];
};

export type StoreAction =
  | { type: 'setHabitat'; id: HabitatId }
  | { type: 'setCondition'; partial: Partial<Conditions> }
  | { type: 'setStep'; step: number }
  | { type: 'setCompare'; a: string | null; b: string | null };

export type Store = StoreState & {
  setHabitat(id: HabitatId): void;
  setCondition(partial: Partial<Conditions>): void;
  setStep(n: number): void;
  setCompare(a: string | null, b: string | null): void;
};

export const DEFAULT_FLOW_CM_S = 10;

function habitatConditions(id: HabitatId): Omit<Conditions, 'flow'> {
  const h = HABITATS[id];
  return { o2: h.o2Percent, pressure: h.pressurePsi, gravity: h.gravityG };
}

export const initialState: StoreState = {
  habitat: 'iss',
  ...habitatConditions('iss'),
  flow: DEFAULT_FLOW_CM_S,
  step: 0,
  compare: [null, null],
};

export function reducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'setHabitat':
      return { ...state, habitat: action.id, ...habitatConditions(action.id) };
    case 'setCondition': {
      const next = { ...state };
      for (const key of ['o2', 'pressure', 'flow', 'gravity'] as const) {
        const v = action.partial[key];
        if (typeof v === 'number' && Number.isFinite(v)) next[key] = v;
      }
      return next;
    }
    case 'setStep':
      return { ...state, step: action.step };
    case 'setCompare':
      return { ...state, compare: [action.a, action.b] };
  }
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children, initial }: { children?: ReactNode; initial?: Partial<StoreState> }) {
  const [state, dispatch] = useReducer(reducer, { ...initialState, ...initial });
  const value = useMemo<Store>(
    () => ({
      ...state,
      setHabitat: (id) => dispatch({ type: 'setHabitat', id }),
      setCondition: (partial) => dispatch({ type: 'setCondition', partial }),
      setStep: (step) => dispatch({ type: 'setStep', step }),
      setCompare: (a, b) => dispatch({ type: 'setCompare', a, b }),
    }),
    [state],
  );
  return createElement(StoreContext.Provider, { value }, children);
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
