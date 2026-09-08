import { LayoutGrid, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface OverviewHeaderProps {
  agentCount: number;
  onClose: () => void;
}

export function OverviewHeader({ agentCount, onClose }: OverviewHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between bg-muted/80 px-4 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <LayoutGrid className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Agent overview</span>
        <span className="text-xs text-muted-foreground/60">({agentCount})</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          ↑ ↓ ← → navigate · Enter open
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              aria-label="Close overview"
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close overview (Esc)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
