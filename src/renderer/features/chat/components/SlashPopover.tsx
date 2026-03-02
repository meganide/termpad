import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';

interface SlashPopoverProps {
  open: boolean;
  onClose: () => void;
}

const slashCommands = [
  { command: '/test', description: 'Run test suite' },
  { command: '/plan', description: 'Create implementation plan' },
  { command: '/revert', description: 'Revert last change' },
];

export function SlashPopover({ open, onClose }: SlashPopoverProps) {
  return (
    <Popover open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <PopoverAnchor className="absolute bottom-full left-4 mb-2" />
      <PopoverContent
        className="w-64 p-1"
        side="top"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid gap-1">
          {slashCommands.map((item) => (
            <button
              key={item.command}
              className="flex flex-col items-start rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={onClose}
            >
              <span className="font-medium">{item.command}</span>
              <span className="text-xs text-muted-foreground">
                {item.description}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
