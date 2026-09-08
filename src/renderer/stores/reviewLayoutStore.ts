import { create } from 'zustand';

interface ReviewLayoutState {
  treeWidth: number;
  setTreeWidth: (width: number) => void;
}

// Layout preferences belong to the window, not an individual worktree or comparison.
export const useReviewLayoutStore = create<ReviewLayoutState>((set) => ({
  treeWidth: 192,
  setTreeWidth: (treeWidth) => set({ treeWidth }),
}));
