import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanningWorkspace } from './PlanningWorkspace';
import { useAppStore } from '../../stores/appStore';
import { createMockRepositoryWithWorktreeSessions, resetAllStores } from '../../../../tests/utils';
import { TooltipProvider } from '../../components/ui/tooltip';

beforeEach(() => {
  resetAllStores();
  localStorage.clear();
  const repository = createMockRepositoryWithWorktreeSessions(
    {
      id: 'repo',
      name: 'Termpad',
      todos: [{ id: 'global', text: 'Global task', completed: false, createdAt: '2026-01-01' }],
    },
    2
  );
  repository.todos = [
    { id: 'global', text: 'Global task', completed: false, createdAt: '2026-01-01' },
  ];
  repository.notes = '<p>Repository context</p>';
  repository.worktreeSessions[1].todos = [
    { id: 'local', text: 'Assigned task', completed: false, createdAt: '2026-01-01' },
  ];
  useAppStore.setState({
    repositories: [repository],
    activeTerminalId: repository.worktreeSessions[0].id,
  });
});

function Harness({ visible = true }: { visible?: boolean }) {
  const repository = useAppStore((state) => state.repositories[0]);
  return (
    <TooltipProvider>
      <div hidden={!visible}>
        <PlanningWorkspace
          repository={repository}
          repositories={[repository]}
          onRepositoryChange={vi.fn()}
          onBack={vi.fn()}
          onDispatch={vi.fn()}
          onCreateWorktree={vi.fn()}
        />
      </div>
    </TooltipProvider>
  );
}

describe('repository planning', () => {
  it('keeps the board, draft and scroll mounted across scopes, views and workspace visits', () => {
    const { rerender } = render(<Harness />);
    const originalTerminal = useAppStore.getState().activeTerminalId;
    const globalPanel = screen.getAllByTestId('todos-panel')[0];
    expect(within(globalPanel).getByText('Global task')).toBeVisible();
    expect(within(globalPanel).getByText('Assigned task')).toBeVisible();
    const scroll = within(globalPanel).getByTestId('todo-scroll-container');
    scroll.scrollTop = 420;
    scroll.scrollLeft = 160;
    fireEvent.change(within(globalPanel).getByRole('textbox'), {
      target: { value: 'Unfinished idea' },
    });
    const session = useAppStore.getState().repositories[0].worktreeSessions[1];
    fireEvent.change(screen.getByLabelText('Planning scope'), { target: { value: session.id } });
    expect(globalPanel).not.toBeVisible();
    expect(
      screen
        .getAllByText('Assigned task')
        .some((element) => element.closest('[data-testid="todos-panel"]') !== globalPanel)
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    fireEvent.change(screen.getByLabelText('Planning scope'), { target: { value: 'global' } });
    expect(screen.getByText('Repository context')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    rerender(<Harness visible={false} />);
    rerender(<Harness />);
    expect(within(globalPanel).getByRole('textbox')).toHaveValue('Unfinished idea');
    expect(within(globalPanel).getByTestId('todo-scroll-container')).toBe(scroll);
    expect(scroll.scrollTop).toBe(420);
    expect(scroll.scrollLeft).toBe(160);
    expect(useAppStore.getState().activeTerminalId).toBe(originalTerminal);
  });

  it('keeps assigned cards visible and updates their worktree label without remounting the board', () => {
    render(<Harness />);
    const scroll = screen.getByTestId('todo-scroll-container');
    scroll.scrollTop = 200;
    const target = useAppStore.getState().repositories[0].worktreeSessions[1];
    act(() => {
      useAppStore.getState().moveGlobalTodoToWorktree('repo', 'global', target.id);
    });
    expect(screen.getByText('Global task')).toBeVisible();
    expect(screen.getAllByTitle(`Assigned to ${target.label}`)).toHaveLength(2);
    expect(screen.getByTestId('todo-scroll-container')).toBe(scroll);
    expect(scroll.scrollTop).toBe(200);
  });
});
