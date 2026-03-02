import { describe, it, expect } from 'vitest';
import {
  getSidebarFocusableItems,
  findItemIndex,
  getNextItem,
  getPreviousItem,
  getItemByIndex,
  getItemById,
  ADD_REPOSITORY_ITEM_ID,
  getAddWorktreeItemId,
} from './sidebarNavigation';
import type { Repository, WorktreeSession } from '../../shared/types';

const createWorktreeSession = (
  id: string,
  overrides?: Partial<WorktreeSession>
): WorktreeSession => ({
  id,
  label: `Worktree Session ${id}`,
  path: `/path/to/${id}`,
  createdAt: '2024-01-01T00:00:00.000Z',
  isExternal: false,
  ...overrides,
});

const createRepository = (id: string, overrides?: Partial<Repository>): Repository => ({
  id,
  name: `Repository ${id}`,
  path: `/path/to/${id}`,

  isBare: false,
  isExpanded: true,
  worktreeSessions: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('getSidebarFocusableItems', () => {
  it('should return only addRepository item for empty projects', () => {
    const result = getSidebarFocusableItems([]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'addRepository',
      id: ADD_REPOSITORY_ITEM_ID,
      projectId: '',
      sessionId: null,
    });
  });

  it('should return project items for projects without sessions plus addWorktree and addRepository', () => {
    const projects = [createRepository('proj-1'), createRepository('proj-2')];

    const result = getSidebarFocusableItems(projects);

    // 2 projects + 2 addWorktree buttons (for each expanded project) + addRepository
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      type: 'project',
      id: 'proj-1',
      projectId: 'proj-1',
      sessionId: null,
    });
    expect(result[1]).toEqual({
      type: 'addWorktree',
      id: getAddWorktreeItemId('proj-1'),
      projectId: 'proj-1',
      sessionId: null,
    });
    expect(result[2]).toEqual({
      type: 'project',
      id: 'proj-2',
      projectId: 'proj-2',
      sessionId: null,
    });
    expect(result[3]).toEqual({
      type: 'addWorktree',
      id: getAddWorktreeItemId('proj-2'),
      projectId: 'proj-2',
      sessionId: null,
    });
    expect(result[4]).toEqual({
      type: 'addRepository',
      id: ADD_REPOSITORY_ITEM_ID,
      projectId: '',
      sessionId: null,
    });
  });

  it('should include addWorktree and sessions for expanded projects', () => {
    const projects = [
      createRepository('proj-1', {
        isExpanded: true,
        worktreeSessions: [createWorktreeSession('sess-1'), createWorktreeSession('sess-2')],
      }),
    ];

    const result = getSidebarFocusableItems(projects);

    // 1 project + 1 addWorktree + 2 sessions + addRepository
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      type: 'project',
      id: 'proj-1',
      projectId: 'proj-1',
      sessionId: null,
    });
    expect(result[1]).toEqual({
      type: 'addWorktree',
      id: getAddWorktreeItemId('proj-1'),
      projectId: 'proj-1',
      sessionId: null,
    });
    expect(result[2]).toEqual({
      type: 'session',
      id: 'sess-1',
      projectId: 'proj-1',
      sessionId: 'sess-1',
    });
    expect(result[3]).toEqual({
      type: 'session',
      id: 'sess-2',
      projectId: 'proj-1',
      sessionId: 'sess-2',
    });
    expect(result[4].type).toBe('addRepository');
  });

  it('should skip sessions for collapsed projects', () => {
    const projects = [
      createRepository('proj-1', {
        isExpanded: false,
        worktreeSessions: [createWorktreeSession('sess-1'), createWorktreeSession('sess-2')],
      }),
    ];

    const result = getSidebarFocusableItems(projects);

    expect(result).toHaveLength(2); // 1 project + addRepository
    expect(result[0]).toEqual({
      type: 'project',
      id: 'proj-1',
      projectId: 'proj-1',
      sessionId: null,
    });
    expect(result[1].type).toBe('addRepository');
  });

  it('should handle mixed expanded/collapsed projects', () => {
    const projects = [
      createRepository('proj-1', {
        isExpanded: true,
        worktreeSessions: [createWorktreeSession('sess-1')],
      }),
      createRepository('proj-2', {
        isExpanded: false,
        worktreeSessions: [createWorktreeSession('sess-2')],
      }),
      createRepository('proj-3', {
        isExpanded: true,
        worktreeSessions: [createWorktreeSession('sess-3')],
      }),
    ];

    const result = getSidebarFocusableItems(projects);

    // proj-1 (expanded): proj-1, addWorktree, sess-1
    // proj-2 (collapsed): proj-2 only
    // proj-3 (expanded): proj-3, addWorktree, sess-3
    // + addRepository at end
    expect(result).toHaveLength(8);
    expect(result.map((item) => item.id)).toEqual([
      'proj-1',
      getAddWorktreeItemId('proj-1'),
      'sess-1',
      'proj-2',
      'proj-3',
      getAddWorktreeItemId('proj-3'),
      'sess-3',
      ADD_REPOSITORY_ITEM_ID,
    ]);
  });

  it('should preserve project order', () => {
    const projects = [
      createRepository('proj-c'),
      createRepository('proj-a'),
      createRepository('proj-b'),
    ];

    const result = getSidebarFocusableItems(projects);

    // Each expanded project has addWorktree after it, addRepository at the end
    expect(result.map((item) => item.id)).toEqual([
      'proj-c',
      getAddWorktreeItemId('proj-c'),
      'proj-a',
      getAddWorktreeItemId('proj-a'),
      'proj-b',
      getAddWorktreeItemId('proj-b'),
      ADD_REPOSITORY_ITEM_ID,
    ]);
  });

  it('should preserve session order within project', () => {
    const projects = [
      createRepository('proj-1', {
        isExpanded: true,
        worktreeSessions: [
          createWorktreeSession('sess-c'),
          createWorktreeSession('sess-a'),
          createWorktreeSession('sess-b'),
        ],
      }),
    ];

    const result = getSidebarFocusableItems(projects);

    expect(result.map((item) => item.id)).toEqual([
      'proj-1',
      getAddWorktreeItemId('proj-1'),
      'sess-c',
      'sess-a',
      'sess-b',
      ADD_REPOSITORY_ITEM_ID,
    ]);
  });
});

describe('findItemIndex', () => {
  // Items order: proj-1, addWorktree(proj-1), sess-1, proj-2, addWorktree(proj-2), addRepository
  const items = getSidebarFocusableItems([
    createRepository('proj-1', {
      isExpanded: true,
      worktreeSessions: [createWorktreeSession('sess-1')],
    }),
    createRepository('proj-2'),
  ]);

  it('should find index of existing item', () => {
    expect(findItemIndex(items, 'proj-1')).toBe(0);
    expect(findItemIndex(items, getAddWorktreeItemId('proj-1'))).toBe(1);
    expect(findItemIndex(items, 'sess-1')).toBe(2);
    expect(findItemIndex(items, 'proj-2')).toBe(3);
    expect(findItemIndex(items, getAddWorktreeItemId('proj-2'))).toBe(4);
    expect(findItemIndex(items, ADD_REPOSITORY_ITEM_ID)).toBe(5);
  });

  it('should return -1 for non-existent item', () => {
    expect(findItemIndex(items, 'non-existent')).toBe(-1);
  });

  it('should return -1 for empty items', () => {
    expect(findItemIndex([], 'any-id')).toBe(-1);
  });
});

describe('getNextItem', () => {
  // Items order: proj-1, addWorktree(proj-1), sess-1, proj-2, addWorktree(proj-2), addRepository
  const items = getSidebarFocusableItems([
    createRepository('proj-1', {
      isExpanded: true,
      worktreeSessions: [createWorktreeSession('sess-1')],
    }),
    createRepository('proj-2'),
  ]);

  it('should return first item when currentId is null', () => {
    const result = getNextItem(items, null);
    expect(result?.id).toBe('proj-1');
  });

  it('should return next item in sequence', () => {
    expect(getNextItem(items, 'proj-1')?.id).toBe(getAddWorktreeItemId('proj-1'));
    expect(getNextItem(items, getAddWorktreeItemId('proj-1'))?.id).toBe('sess-1');
    expect(getNextItem(items, 'sess-1')?.id).toBe('proj-2');
    expect(getNextItem(items, 'proj-2')?.id).toBe(getAddWorktreeItemId('proj-2'));
    expect(getNextItem(items, getAddWorktreeItemId('proj-2'))?.id).toBe(ADD_REPOSITORY_ITEM_ID);
  });

  it('should wrap around to first item', () => {
    expect(getNextItem(items, ADD_REPOSITORY_ITEM_ID)?.id).toBe('proj-1');
  });

  it('should return first item for non-existent currentId', () => {
    expect(getNextItem(items, 'non-existent')?.id).toBe('proj-1');
  });

  it('should return null for empty items', () => {
    expect(getNextItem([], 'any-id')).toBeNull();
  });
});

describe('getPreviousItem', () => {
  // Items order: proj-1, addWorktree(proj-1), sess-1, proj-2, addWorktree(proj-2), addRepository
  const items = getSidebarFocusableItems([
    createRepository('proj-1', {
      isExpanded: true,
      worktreeSessions: [createWorktreeSession('sess-1')],
    }),
    createRepository('proj-2'),
  ]);

  it('should return last item (addRepository) when currentId is null', () => {
    const result = getPreviousItem(items, null);
    expect(result?.id).toBe(ADD_REPOSITORY_ITEM_ID);
  });

  it('should return previous item in sequence', () => {
    expect(getPreviousItem(items, ADD_REPOSITORY_ITEM_ID)?.id).toBe(getAddWorktreeItemId('proj-2'));
    expect(getPreviousItem(items, getAddWorktreeItemId('proj-2'))?.id).toBe('proj-2');
    expect(getPreviousItem(items, 'proj-2')?.id).toBe('sess-1');
    expect(getPreviousItem(items, 'sess-1')?.id).toBe(getAddWorktreeItemId('proj-1'));
    expect(getPreviousItem(items, getAddWorktreeItemId('proj-1'))?.id).toBe('proj-1');
  });

  it('should wrap around to last item (addRepository)', () => {
    expect(getPreviousItem(items, 'proj-1')?.id).toBe(ADD_REPOSITORY_ITEM_ID);
  });

  it('should return last item (addRepository) for non-existent currentId', () => {
    expect(getPreviousItem(items, 'non-existent')?.id).toBe(ADD_REPOSITORY_ITEM_ID);
  });

  it('should return null for empty items', () => {
    expect(getPreviousItem([], 'any-id')).toBeNull();
  });
});

describe('getItemByIndex', () => {
  // Items order: proj-1, addWorktree(proj-1), sess-1, proj-2, addWorktree(proj-2), addRepository
  const items = getSidebarFocusableItems([
    createRepository('proj-1', {
      isExpanded: true,
      worktreeSessions: [createWorktreeSession('sess-1')],
    }),
    createRepository('proj-2'),
  ]);

  it('should return item at 1-based index', () => {
    expect(getItemByIndex(items, 1)?.id).toBe('proj-1');
    expect(getItemByIndex(items, 2)?.id).toBe(getAddWorktreeItemId('proj-1'));
    expect(getItemByIndex(items, 3)?.id).toBe('sess-1');
    expect(getItemByIndex(items, 4)?.id).toBe('proj-2');
    expect(getItemByIndex(items, 5)?.id).toBe(getAddWorktreeItemId('proj-2'));
    expect(getItemByIndex(items, 6)?.id).toBe(ADD_REPOSITORY_ITEM_ID);
  });

  it('should return null for index 0', () => {
    expect(getItemByIndex(items, 0)).toBeNull();
  });

  it('should return null for out of bounds index', () => {
    // 6 items now (proj-1, addWorktree(proj-1), sess-1, proj-2, addWorktree(proj-2), addRepository)
    expect(getItemByIndex(items, 7)).toBeNull();
    expect(getItemByIndex(items, 100)).toBeNull();
  });

  it('should return null for negative index', () => {
    expect(getItemByIndex(items, -1)).toBeNull();
  });

  it('should return null for empty items', () => {
    expect(getItemByIndex([], 1)).toBeNull();
  });
});

describe('getItemById', () => {
  // Items order: proj-1, addWorktree(proj-1), sess-1, proj-2, addWorktree(proj-2), addRepository
  const items = getSidebarFocusableItems([
    createRepository('proj-1', {
      isExpanded: true,
      worktreeSessions: [createWorktreeSession('sess-1')],
    }),
    createRepository('proj-2'),
  ]);

  it('should find project item by ID', () => {
    const result = getItemById(items, 'proj-1');
    expect(result).toEqual({
      type: 'project',
      id: 'proj-1',
      projectId: 'proj-1',
      sessionId: null,
    });
  });

  it('should find addWorktree item by ID', () => {
    const result = getItemById(items, getAddWorktreeItemId('proj-1'));
    expect(result).toEqual({
      type: 'addWorktree',
      id: getAddWorktreeItemId('proj-1'),
      projectId: 'proj-1',
      sessionId: null,
    });
  });

  it('should find session item by ID', () => {
    const result = getItemById(items, 'sess-1');
    expect(result).toEqual({
      type: 'session',
      id: 'sess-1',
      projectId: 'proj-1',
      sessionId: 'sess-1',
    });
  });

  it('should find addRepository item by ID', () => {
    const result = getItemById(items, ADD_REPOSITORY_ITEM_ID);
    expect(result).toEqual({
      type: 'addRepository',
      id: ADD_REPOSITORY_ITEM_ID,
      projectId: '',
      sessionId: null,
    });
  });

  it('should return null for non-existent ID', () => {
    expect(getItemById(items, 'non-existent')).toBeNull();
  });

  it('should return null for empty items', () => {
    expect(getItemById([], 'any-id')).toBeNull();
  });
});
