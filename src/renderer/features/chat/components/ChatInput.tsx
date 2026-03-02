import { useState, useRef, useEffect } from 'react';
import { Send, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SlashPopover } from './SlashPopover';
import { MentionPopover } from './MentionPopover';

export function ChatInput() {
  const [value, setValue] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    const lastChar = newValue.slice(-1);
    setShowSlash(lastChar === '/');
    setShowMention(lastChar === '@');
  };

  return (
    <div className="shrink-0 bg-background p-4">
      <div className="relative rounded-xl bg-card p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            placeholder="Message..."
            className="min-h-[56px] resize-none border-0 bg-transparent dark:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none text-sm"
            rows={2}
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground">
                <Plus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="grid gap-1">
                <Button variant="ghost" className="justify-start">
                  Attach file
                </Button>
                <Button variant="ghost" className="justify-start">
                  Attach image
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" className="h-9 w-9 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Enter to send</p>
            </TooltipContent>
          </Tooltip>

          <SlashPopover open={showSlash} onClose={() => setShowSlash(false)} />
          <MentionPopover
            open={showMention}
            onClose={() => setShowMention(false)}
          />
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>Claude 3.5 Sonnet</span>
          <span className="text-muted-foreground/50">•</span>
          <span>1,234 tokens</span>
        </div>
      </div>
    </div>
  );
}
