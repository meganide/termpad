import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useWorkspaceStore } from './store';

describe('workspaceStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useWorkspaceStore.setState({
      activeTab: 'task-1',
      tabs: ['task-1', 'task-2'],
      taskStates: {
        'task-1': { content: '' },
        'task-2': { content: '' },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have task-1 as default active tab', () => {
      const { activeTab } = useWorkspaceStore.getState();
      expect(activeTab).toBe('task-1');
    });

    it('should have two default tabs', () => {
      const { tabs } = useWorkspaceStore.getState();
      expect(tabs).toEqual(['task-1', 'task-2']);
    });

    it('should have empty task states for default tabs', () => {
      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates).toEqual({
        'task-1': { content: '' },
        'task-2': { content: '' },
      });
    });

    it('should have all expected properties in state', () => {
      const state = useWorkspaceStore.getState();
      expect(state).toHaveProperty('activeTab');
      expect(state).toHaveProperty('tabs');
      expect(state).toHaveProperty('taskStates');
      expect(state).toHaveProperty('setActiveTab');
      expect(state).toHaveProperty('updateTaskContent');
    });
  });

  describe('setActiveTab', () => {
    it('should set active tab to task-2', () => {
      const { setActiveTab } = useWorkspaceStore.getState();
      setActiveTab('task-2');

      const { activeTab } = useWorkspaceStore.getState();
      expect(activeTab).toBe('task-2');
    });

    it('should set active tab to a new tab id', () => {
      const { setActiveTab } = useWorkspaceStore.getState();
      setActiveTab('task-3');

      const { activeTab } = useWorkspaceStore.getState();
      expect(activeTab).toBe('task-3');
    });

    it('should allow setting same tab again', () => {
      const { setActiveTab } = useWorkspaceStore.getState();
      setActiveTab('task-1');

      const { activeTab } = useWorkspaceStore.getState();
      expect(activeTab).toBe('task-1');
    });

    it('should switch between tabs multiple times', () => {
      const { setActiveTab } = useWorkspaceStore.getState();

      setActiveTab('task-2');
      expect(useWorkspaceStore.getState().activeTab).toBe('task-2');

      setActiveTab('task-1');
      expect(useWorkspaceStore.getState().activeTab).toBe('task-1');

      setActiveTab('task-2');
      expect(useWorkspaceStore.getState().activeTab).toBe('task-2');
    });

    it('should not affect other state properties', () => {
      const initialTabs = useWorkspaceStore.getState().tabs;
      const initialTaskStates = useWorkspaceStore.getState().taskStates;

      const { setActiveTab } = useWorkspaceStore.getState();
      setActiveTab('task-2');

      expect(useWorkspaceStore.getState().tabs).toEqual(initialTabs);
      expect(useWorkspaceStore.getState().taskStates).toEqual(initialTaskStates);
    });
  });

  describe('updateTaskContent', () => {
    it('should update content for task-1', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();
      updateTaskContent('task-1', 'Hello World');

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe('Hello World');
    });

    it('should update content for task-2', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();
      updateTaskContent('task-2', 'Test content');

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-2'].content).toBe('Test content');
    });

    it('should create new task state for non-existent tab', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();
      updateTaskContent('task-3', 'New task content');

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-3']).toEqual({ content: 'New task content' });
    });

    it('should preserve other task states when updating one', () => {
      // Set initial content for task-1
      const { updateTaskContent } = useWorkspaceStore.getState();
      updateTaskContent('task-1', 'Task 1 content');

      // Update task-2
      updateTaskContent('task-2', 'Task 2 content');

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe('Task 1 content');
      expect(taskStates['task-2'].content).toBe('Task 2 content');
    });

    it('should allow clearing content by setting empty string', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();
      updateTaskContent('task-1', 'Some content');

      expect(useWorkspaceStore.getState().taskStates['task-1'].content).toBe('Some content');

      updateTaskContent('task-1', '');

      expect(useWorkspaceStore.getState().taskStates['task-1'].content).toBe('');
    });

    it('should handle multiline content', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      updateTaskContent('task-1', multilineContent);

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe(multilineContent);
    });

    it('should handle special characters in content', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();
      const specialContent = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      updateTaskContent('task-1', specialContent);

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe(specialContent);
    });

    it('should handle unicode content', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();
      const unicodeContent = '你好世界 🎉 مرحبا';
      updateTaskContent('task-1', unicodeContent);

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe(unicodeContent);
    });

    it('should not affect activeTab when updating content', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();

      expect(useWorkspaceStore.getState().activeTab).toBe('task-1');

      updateTaskContent('task-2', 'Content for task-2');

      expect(useWorkspaceStore.getState().activeTab).toBe('task-1');
    });
  });

  describe('persistence', () => {
    it('should have correct storage name configured', () => {
      const persist = useWorkspaceStore.persist;
      expect(persist).toBeDefined();
      expect(persist.getOptions().name).toBe('termpad-workspace');
    });

    it('should persist active tab changes to storage', () => {
      const { setActiveTab } = useWorkspaceStore.getState();
      setActiveTab('task-2');

      const storedData = localStorage.getItem('termpad-workspace');
      expect(storedData).toBeDefined();

      const parsed = JSON.parse(storedData as string);
      expect(parsed.state.activeTab).toBe('task-2');
    });

    it('should persist task content changes to storage', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();
      updateTaskContent('task-1', 'Persisted content');

      const storedData = localStorage.getItem('termpad-workspace');
      expect(storedData).toBeDefined();

      const parsed = JSON.parse(storedData as string);
      expect(parsed.state.taskStates['task-1'].content).toBe('Persisted content');
    });

    it('should have rehydrate method available', () => {
      expect(useWorkspaceStore.persist.rehydrate).toBeDefined();
      expect(typeof useWorkspaceStore.persist.rehydrate).toBe('function');
    });
  });

  describe('state access patterns', () => {
    it('should allow accessing state directly', () => {
      const state = useWorkspaceStore.getState();
      expect(state).toHaveProperty('activeTab');
      expect(state).toHaveProperty('tabs');
      expect(state).toHaveProperty('taskStates');
      expect(state).toHaveProperty('setActiveTab');
      expect(state).toHaveProperty('updateTaskContent');
    });

    it('should return functions for setActiveTab and updateTaskContent', () => {
      const { setActiveTab, updateTaskContent } = useWorkspaceStore.getState();
      expect(typeof setActiveTab).toBe('function');
      expect(typeof updateTaskContent).toBe('function');
    });

    it('should allow subscribing to state changes', () => {
      const listener = vi.fn();
      const unsubscribe = useWorkspaceStore.subscribe(listener);

      const { setActiveTab } = useWorkspaceStore.getState();
      setActiveTab('task-2');

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid tab switches', () => {
      const { setActiveTab } = useWorkspaceStore.getState();

      for (let i = 0; i < 20; i++) {
        setActiveTab(i % 2 === 0 ? 'task-1' : 'task-2');
      }

      // i=19 is odd, so last switch set task-2
      expect(useWorkspaceStore.getState().activeTab).toBe('task-2');
    });

    it('should handle rapid content updates', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();

      for (let i = 0; i < 100; i++) {
        updateTaskContent('task-1', `Update ${i}`);
      }

      expect(useWorkspaceStore.getState().taskStates['task-1'].content).toBe('Update 99');
    });

    it('should maintain consistency after mixed operations', () => {
      const state = useWorkspaceStore.getState();

      // Switch tab and update content
      state.setActiveTab('task-2');
      state.updateTaskContent('task-2', 'Content after switch');

      expect(useWorkspaceStore.getState().activeTab).toBe('task-2');
      expect(useWorkspaceStore.getState().taskStates['task-2'].content).toBe(
        'Content after switch'
      );

      // Switch back and update different tab
      state.setActiveTab('task-1');
      state.updateTaskContent('task-1', 'Content for task-1');

      expect(useWorkspaceStore.getState().activeTab).toBe('task-1');
      expect(useWorkspaceStore.getState().taskStates['task-1'].content).toBe('Content for task-1');
      // Previous content should be preserved
      expect(useWorkspaceStore.getState().taskStates['task-2'].content).toBe(
        'Content after switch'
      );
    });

    it('should handle very long content', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();
      const longContent = 'x'.repeat(100000);
      updateTaskContent('task-1', longContent);

      expect(useWorkspaceStore.getState().taskStates['task-1'].content).toBe(longContent);
      expect(useWorkspaceStore.getState().taskStates['task-1'].content.length).toBe(100000);
    });

    it('should handle tab ids with special characters', () => {
      const { setActiveTab, updateTaskContent } = useWorkspaceStore.getState();

      const specialTabId = 'tab-with-special_chars.123';
      setActiveTab(specialTabId);
      updateTaskContent(specialTabId, 'Special tab content');

      expect(useWorkspaceStore.getState().activeTab).toBe(specialTabId);
      expect(useWorkspaceStore.getState().taskStates[specialTabId].content).toBe(
        'Special tab content'
      );
    });

    it('should handle empty tab id gracefully', () => {
      const { setActiveTab } = useWorkspaceStore.getState();
      setActiveTab('');

      expect(useWorkspaceStore.getState().activeTab).toBe('');
    });

    it('should handle multiple task states being created', () => {
      const { updateTaskContent } = useWorkspaceStore.getState();

      for (let i = 0; i < 10; i++) {
        updateTaskContent(`task-${i}`, `Content for task ${i}`);
      }

      const { taskStates } = useWorkspaceStore.getState();
      expect(Object.keys(taskStates)).toHaveLength(10);

      for (let i = 0; i < 10; i++) {
        expect(taskStates[`task-${i}`].content).toBe(`Content for task ${i}`);
      }
    });
  });

  describe('state immutability', () => {
    it('should not mutate previous taskStates reference', () => {
      const initialTaskStates = useWorkspaceStore.getState().taskStates;
      const { updateTaskContent } = useWorkspaceStore.getState();

      updateTaskContent('task-1', 'New content');

      const newTaskStates = useWorkspaceStore.getState().taskStates;

      // References should be different
      expect(newTaskStates).not.toBe(initialTaskStates);

      // Original should be unchanged
      expect(initialTaskStates['task-1'].content).toBe('');
    });
  });
});
