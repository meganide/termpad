import { Bot, FileCode } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';

interface MentionPopoverProps {
  open: boolean;
  onClose: () => void;
}

const mentions = [
  { name: '@agent-1', type: 'agent' as const },
  { name: '@agent-2', type: 'agent' as const },
  { name: '@main.ts', type: 'file' as const },
  { name: '@utils.ts', type: 'file' as const },
];

export function MentionPopover({ open, onClose }: MentionPopoverProps) {
  return (
    <Popover open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <PopoverAnchor className="absolute bottom-full left-4 mb-2" />
      <PopoverContent
        className="w-56 p-1"
        side="top"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid gap-1">
          {mentions.map((item) => (
            <button
              key={item.name}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={onClose}
            >
              {item.type === 'agent' ? (
                <Bot className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileCode className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
