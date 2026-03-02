import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ThoughtBlockData } from '../types';

interface ThoughtBlockProps {
  data: ThoughtBlockData;
}

export function ThoughtBlock({ data }: ThoughtBlockProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-muted-foreground/50 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/70" />
        </span>

        <span className="flex-1 text-left">{data.label}</span>

        <ChevronRight
          className={cn(
            'h-4 w-4 transition-transform',
            isOpen && 'rotate-90'
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 rounded-lg bg-secondary overflow-hidden">
          <div className="max-h-48 overflow-auto p-3">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
              {data.output}
            </pre>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
