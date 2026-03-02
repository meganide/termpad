import { useWorkspaceStore } from './store';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';

interface TaskViewProps {
  tabId: string;
}

export function TaskView({ tabId }: TaskViewProps) {
  const { taskStates, updateTaskContent } = useWorkspaceStore();
  const content = taskStates[tabId]?.content || '';

  const handlePing = async () => {
    try {
      const response = await window.electronAPI.ping();
      toast.success(`Response: ${response}`);
    } catch {
      toast.error('Ping failed');
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tabId === 'task-1' ? 'Task 1' : 'Task 2'}</h1>
        <Button onClick={handlePing}>Test IPC (Ping)</Button>
      </div>

      <div className="flex-1">
        <Textarea
          placeholder="Type something here... This content persists when switching tabs."
          className="h-full min-h-[200px] resize-none"
          value={content}
          onChange={(e) => updateTaskContent(tabId, e.target.value)}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Content is automatically saved and persists across tab switches and app restarts.
      </p>
    </div>
  );
}
