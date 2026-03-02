import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TaskState {
  content: string;
}

interface WorkspaceState {
  activeTab: string;
  tabs: string[];
  taskStates: Record<string, TaskState>;
  setActiveTab: (tabId: string) => void;
  updateTaskContent: (tabId: string, content: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeTab: 'task-1',
      tabs: ['task-1', 'task-2'],
      taskStates: {
        'task-1': { content: '' },
        'task-2': { content: '' },
      },
      setActiveTab: (tabId) => set({ activeTab: tabId }),
      updateTaskContent: (tabId, content) =>
        set((state) => ({
          taskStates: {
            ...state.taskStates,
            [tabId]: { content },
          },
        })),
    }),
    {
      name: 'termpad-workspace',
    }
  )
);
