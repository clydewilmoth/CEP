import { create } from 'zustand';

export const useContext = create<{
  initialised: boolean;
  setInitialised: (initialised: boolean) => void;
  tryInitialiseListener: number;
  tryInitialise: () => void;
  dbState: number;
  dbChange: () => void;
  lastUpdate: string | null;
  setLastUpdate: (lastUpdate: string) => void;
}>((set) => ({
  initialised: false,
  setInitialised: (initialised) => set({ initialised }),
  tryInitialiseListener: 0,
  tryInitialise: () => set((state) => ({ tryInitialiseListener: state.tryInitialiseListener + 1 })),
  dbState: 0,
  dbChange: () => set((state) => ({ dbState: state.dbState + 1 })),
  lastUpdate: null,
  setLastUpdate: (lastUpdate) => set({ lastUpdate })
}));