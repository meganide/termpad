import { describe, expect, it } from 'vitest';
import { getScopeIndicators, hasNoteContent } from './scopeIndicators';

describe('scope indicators', () => {
  it('ignores empty rich-text editor markup', () => {
    for (const note of [undefined, '', ' ', '<p><br></p>', '<div>&nbsp;</div>', '<b>\u200B</b>'])
      expect(hasNoteContent(note)).toBe(false);
    expect(hasNoteContent('<p>Repository note</p>')).toBe(true);
    expect(hasNoteContent('Plain text')).toBe(true);
  });

  it('uses only worktree content in a linked worktree', () => {
    expect(getScopeIndicators({ notes: '<b>Shared</b>' }, { notes: '<p><br></p>' }).notes).toBe(
      false
    );
    expect(getScopeIndicators(undefined, { notes: 'Local' }).notes).toBe(true);
    const todo = { id: '1', text: 'Task', completed: true, createdAt: '' };
    expect(getScopeIndicators({ todos: [todo] }, { todos: [] })).toEqual({
      scope: 'worktree',
      todos: { completed: 0, total: 0 },
      notes: false,
    });
  });

  it('uses local content in the primary checkout, like other worktrees', () => {
    const todo = { id: '1', text: 'Task', completed: true, createdAt: '' };
    expect(
      getScopeIndicators(
        { todos: [todo], notes: 'Global' },
        {
          isMainWorktree: true,
          todos: [todo, todo],
          notes: '',
        }
      )
    ).toEqual({ scope: 'worktree', todos: { completed: 2, total: 2 }, notes: false });
    expect(getScopeIndicators({ notes: '' }, { isMainWorktree: true, notes: 'Local' }).notes).toBe(
      true
    );
    expect(getScopeIndicators().todos).toEqual({ completed: 0, total: 0 });
  });
});
