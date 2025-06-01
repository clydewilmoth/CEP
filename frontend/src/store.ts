import { create } from 'zustand';

export const useInit = create<{
  initialised: boolean;
  setInitialised: (initialised: boolean) => void;
  dsnOpen: boolean;
  setDsnOpen: (open: boolean) => void;
  appRender: number;
  appRerender: () => void;
  dbState: number;
  dbChange: () => void;
}>((set) => ({
  initialised: false,
  setInitialised: (initialised) => set({ initialised }),
  dsnOpen: false,
  setDsnOpen: (open) => set({ dsnOpen: open }),
  appRender: 0,
  appRerender: () => set((state) => ({ appRender: state.appRender + 1 })),
  dbState: 0,
  dbChange: () => set((state) => ({ dbState: state.dbState + 1 })),
}));