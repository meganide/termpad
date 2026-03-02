import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarNavigation } from './useSidebarNavigation';
import { useAppStore } from '../stores/appStore';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
} from '../../../tests/utils';
import { ADD_REPOSITORY_ITEM_ID, getAddWorktreeItemId } from '../utils/sidebarNavigation';

describe('useSidebarNavigation', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('focusableItems', () => {
    it('should return only addRepository item when no projects', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      expect(result.current.focusableItems).toHaveLength(1);
      expect(result.current.focusableItems[0].id).toBe(ADD_REPOSITORY_ITEM_ID);
    });

    it('should flatten expanded project with addWorktree, sessions, plus addRepository', () => {
      useAppStore.setState({
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [createMockWorktreeSession({ id: 'sess-1' })],
          }),
        ],
      });

      const { result } = renderHook(() => useSidebarNavigation());

      // proj + addWorktree + session + addRepository
      expect(result.current.focusableItems).toHaveLength(4);
      expect(result.current.focusableItems[0].id).toBe('proj-1');
      expect(result.current.focusableItems[1].id).toBe(getAddWorktreeItemId('proj-1'));
      expect(result.current.focusableItems[2].id).toBe('sess-1');
      expect(result.current.focusableItems[3].id).toBe(ADD_REPOSITORY_ITEM_ID);
    });

    it('should skip sessions for collapsed projects', () => {
      useAppStore.setState({
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: false,
            worktreeSessions: [createMockWorktreeSession({ id: 'sess-1' })],
          }),
        ],
      });

      const { result } = renderHook(() => useSidebarNavigation());

      expect(result.current.focusableItems).toHaveLength(2); // proj + addRepository
      expect(result.current.focusableItems[0].id).toBe('proj-1');
      expect(result.current.focusableItems[1].id).toBe(ADD_REPOSITORY_ITEM_ID);
    });
  });

  describe('focusedItemId', () => {
    it('should return null when mainTerminal is focused', () => {
      useAppStore.setState({
        focusArea: 'mainTerminal',
        sidebarFocusedItemId: 'some-id',
      });

      const { result } = renderHook(() => useSidebarNavigation());

      expect(result.current.focusedItemId).toBeNull();
    });

    it('should return sidebarFocusedItemId when sidebar is focused', () => {
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [createMockRepository({ id: 'proj-1' })],
      });

      const { result } = renderHook(() => useSidebarNavigation());

      expect(result.current.focusedItemId).toBe('proj-1');
    });

    it('should fallback to activeTerminalId when no sidebarFocusedItemId', () => {
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: null,
        activeTerminalId: 'sess-1',
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [createMockWorktreeSession({ id: 'sess-1' })],
          }),
        ],
      });

      const { result } = renderHook(() => useSidebarNavigation());

      expect(result.current.focusedItemId).toBe('sess-1');
    });

    it('should fallback to first item when no focused or active item', () => {
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: null,
        activeTerminalId: null,
        repositories: [createMockRepository({ id: 'proj-1' })],
      });

      const { result } = renderHook(() => useSidebarNavigation());

      expect(result.current.focusedItemId).toBe('proj-1');
    });
  });

  describe('handleKeyDown - arrow navigation', () => {
    beforeEach(() => {
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [
              createMockWorktreeSession({ id: 'sess-1' }),
              createMockWorktreeSession({ id: 'sess-2' }),
            ],
          }),
          createMockRepository({ id: 'proj-2' }),
        ],
      });
    });

    it('should move to next item (addWorktree) on ArrowDown from project', () => {
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      // From proj-1, next is addWorktree(proj-1)
      expect(useAppStore.getState().sidebarFocusedItemId).toBe(getAddWorktreeItemId('proj-1'));
    });

    it('should move to previous item (addWorktree) on ArrowUp from session', () => {
      useAppStore.setState({ sidebarFocusedItemId: 'sess-1' });
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      // From sess-1, previous is addWorktree(proj-1)
      expect(useAppStore.getState().sidebarFocusedItemId).toBe(getAddWorktreeItemId('proj-1'));
    });

    it('should move to addRepository on ArrowDown at end of projects', () => {
      useAppStore.setState({ sidebarFocusedItemId: 'proj-2' });
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().sidebarFocusedItemId).toBe(ADD_REPOSITORY_ITEM_ID);
    });

    it('should wrap around to first item on ArrowDown from addRepository', () => {
      useAppStore.setState({ sidebarFocusedItemId: ADD_REPOSITORY_ITEM_ID });
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().sidebarFocusedItemId).toBe('proj-1');
    });

    it('should wrap around to addRepository on ArrowUp at start', () => {
      useAppStore.setState({ sidebarFocusedItemId: 'proj-1' });
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().sidebarFocusedItemId).toBe(ADD_REPOSITORY_ITEM_ID);
    });
  });

  describe('handleKeyDown - expand/collapse', () => {
    beforeEach(() => {
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [createMockWorktreeSession({ id: 'sess-1' })],
          }),
        ],
      });
    });

    it('should collapse project on ArrowLeft when expanded', () => {
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().repositories[0].isExpanded).toBe(false);
    });

    it('should expand project on ArrowRight when collapsed', () => {
      useAppStore.setState({
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: false,
            worktreeSessions: [createMockWorktreeSession({ id: 'sess-1' })],
          }),
        ],
      });

      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().repositories[0].isExpanded).toBe(true);
    });

    it('should move to parent project on ArrowLeft when on session', () => {
      useAppStore.setState({ sidebarFocusedItemId: 'sess-1' });
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().sidebarFocusedItemId).toBe('proj-1');
    });
  });

  describe('handleKeyDown - Enter key', () => {
    beforeEach(() => {
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'sess-1',
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [createMockWorktreeSession({ id: 'sess-1' })],
          }),
        ],
      });
    });

    it('should select session and return to mainTerminal on Enter', () => {
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().activeTerminalId).toBe('sess-1');
      expect(useAppStore.getState().focusArea).toBe('mainTerminal');
    });

    it('should toggle project expand on Enter when on project', () => {
      useAppStore.setState({ sidebarFocusedItemId: 'proj-1' });
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().repositories[0].isExpanded).toBe(false);
    });
  });

  describe('handleKeyDown - Escape key', () => {
    it('should return to mainTerminal on Escape when a terminal is active', () => {
      const session = createMockWorktreeSession({ id: 'sess-1' });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [session],
      });
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [repository],
        activeTerminalId: session.id,
      });

      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'Escape' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().focusArea).toBe('mainTerminal');
    });

    it('should return to app on Escape when no terminal is active', () => {
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [createMockRepository({ id: 'proj-1' })],
        activeTerminalId: null,
      });

      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'Escape' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().focusArea).toBe('app');
    });
  });

  describe('handleKeyDown - number keys', () => {
    // Helper to create shortcut
    const shortcut = (key: string) => ({
      key,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });

    beforeEach(() => {
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [
              createMockWorktreeSession({ id: 'sess-1', customShortcut: shortcut('1') }),
              createMockWorktreeSession({ id: 'sess-2', customShortcut: shortcut('2') }),
            ],
          }),
          createMockRepository({ id: 'proj-2' }),
        ],
      });
    });

    it('should select session with shortcut 1 on key 1', () => {
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: '1' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      // Key 1 selects session with customShortcut '1' and returns to mainTerminal
      expect(useAppStore.getState().activeTerminalId).toBe('sess-1');
      expect(useAppStore.getState().focusArea).toBe('mainTerminal');
    });

    it('should select session with shortcut 2 on key 2', () => {
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: '2' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      // Key 2 selects session with customShortcut '2' and returns to mainTerminal
      expect(useAppStore.getState().activeTerminalId).toBe('sess-2');
      expect(useAppStore.getState().focusArea).toBe('mainTerminal');
    });

    it('should handle key 0 for session with shortcut 0', () => {
      // Set up sessions with shortcuts 1-9 and 0
      const sessions = [
        ...Array.from({ length: 9 }, (_, i) =>
          createMockWorktreeSession({
            id: `sess-${i + 1}`,
            customShortcut: shortcut(String(i + 1)),
          })
        ),
        createMockWorktreeSession({ id: 'sess-10', customShortcut: shortcut('0') }),
      ];
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: null,
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: sessions,
          }),
        ],
      });

      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: '0' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      // Key 0 selects session with customShortcut '0'
      expect(useAppStore.getState().activeTerminalId).toBe('sess-10');
    });

    it('should do nothing when no session has matching shortcut', () => {
      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: '9' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      // No session has shortcut '9' - state unchanged
      expect(useAppStore.getState().sidebarFocusedItemId).toBe('proj-1');
      expect(useAppStore.getState().focusArea).toBe('sidebar');
    });
  });

  describe('handleKeyDown - mainTerminal focused', () => {
    it('should not handle keys when mainTerminal is focused', () => {
      useAppStore.setState({
        focusArea: 'mainTerminal',
        sidebarFocusedItemId: 'proj-1',
        repositories: [createMockRepository({ id: 'proj-1' })],
      });

      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      // Should not change anything
      expect(useAppStore.getState().sidebarFocusedItemId).toBe('proj-1');
    });
  });

  describe('onSessionSelect callback', () => {
    // Helper to create shortcut
    const shortcut = (key: string) => ({
      key,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });

    it('should call onSessionSelect when session is selected via Enter key', () => {
      const onSessionSelect = vi.fn();
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'sess-1',
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [createMockWorktreeSession({ id: 'sess-1' })],
          }),
        ],
      });

      const { result } = renderHook(() => useSidebarNavigation({ onSessionSelect }));
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(onSessionSelect).toHaveBeenCalledTimes(1);
    });

    it('should call onSessionSelect when session is selected via number key', () => {
      const onSessionSelect = vi.fn();
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [
              createMockWorktreeSession({ id: 'sess-1', customShortcut: shortcut('1') }),
            ],
          }),
        ],
      });

      const { result } = renderHook(() => useSidebarNavigation({ onSessionSelect }));
      const event = new KeyboardEvent('keydown', { key: '1' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(onSessionSelect).toHaveBeenCalledTimes(1);
    });

    it('should call onSessionSelect when session is selected via custom shortcut', () => {
      const onSessionSelect = vi.fn();
      const customShortcut = {
        key: 'a',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [createMockWorktreeSession({ id: 'sess-1', customShortcut })],
          }),
        ],
      });

      const { result } = renderHook(() => useSidebarNavigation({ onSessionSelect }));
      const event = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(onSessionSelect).toHaveBeenCalledTimes(1);
    });

    it('should not call onSessionSelect when project is toggled via Enter', () => {
      const onSessionSelect = vi.fn();
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [createMockWorktreeSession({ id: 'sess-1' })],
          }),
        ],
      });

      const { result } = renderHook(() => useSidebarNavigation({ onSessionSelect }));
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      // Enter on project toggles expand, doesn't select session
      expect(onSessionSelect).not.toHaveBeenCalled();
    });
  });

  describe('onAddRepository callback', () => {
    it('should call onAddRepository when Enter is pressed on addRepository item', () => {
      const onAddRepository = vi.fn();
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: ADD_REPOSITORY_ITEM_ID,
        repositories: [createMockRepository({ id: 'proj-1' })],
      });

      const { result } = renderHook(() => useSidebarNavigation({ onAddRepository }));
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(onAddRepository).toHaveBeenCalledTimes(1);
    });

    it('should not call onAddRepository when Enter is pressed on a project', () => {
      const onAddRepository = vi.fn();
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [createMockRepository({ id: 'proj-1' })],
      });

      const { result } = renderHook(() => useSidebarNavigation({ onAddRepository }));
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(onAddRepository).not.toHaveBeenCalled();
    });
  });

  describe('onNewWorktree callback', () => {
    it('should call onNewWorktree with repositoryId when Enter is pressed on addWorktree item', () => {
      const onNewWorktree = vi.fn();
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: getAddWorktreeItemId('proj-1'),
        repositories: [createMockRepository({ id: 'proj-1', isExpanded: true })],
      });

      const { result } = renderHook(() => useSidebarNavigation({ onNewWorktree }));
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(onNewWorktree).toHaveBeenCalledTimes(1);
      expect(onNewWorktree).toHaveBeenCalledWith('proj-1');
    });

    it('should not call onNewWorktree when Enter is pressed on a project', () => {
      const onNewWorktree = vi.fn();
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: 'proj-1',
        repositories: [createMockRepository({ id: 'proj-1' })],
      });

      const { result } = renderHook(() => useSidebarNavigation({ onNewWorktree }));
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(onNewWorktree).not.toHaveBeenCalled();
    });

    it('should move to parent project on ArrowLeft from addWorktree', () => {
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: getAddWorktreeItemId('proj-1'),
        repositories: [
          createMockRepository({
            id: 'proj-1',
            isExpanded: true,
            worktreeSessions: [createMockWorktreeSession({ id: 'sess-1' })],
          }),
        ],
      });

      const { result } = renderHook(() => useSidebarNavigation());
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(useAppStore.getState().sidebarFocusedItemId).toBe('proj-1');
    });
  });
});
