import { create } from 'zustand';

export const useModuleStore = create((set) => ({
  activeModule: null,

  setModule: (moduleName) =>
    set({
      activeModule: moduleName,
    }),

  clearModule: () =>
    set({
      activeModule: null,
    }),
}));
