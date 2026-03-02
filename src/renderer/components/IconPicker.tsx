import {
  Terminal,
  Sparkles,
  Code,
  Bot,
  Zap,
  Command,
  Play,
  Wrench,
  Star,
  Heart,
  Rocket,
  Coffee,
  MessageSquare,
  Cpu,
  Globe,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

export const PRESET_ICONS: Record<string, LucideIcon> = {
  terminal: Terminal,
  sparkles: Sparkles,
  code: Code,
  bot: Bot,
  zap: Zap,
  command: Command,
  play: Play,
  wrench: Wrench,
  star: Star,
  heart: Heart,
  rocket: Rocket,
  coffee: Coffee,
  'message-square': MessageSquare,
  cpu: Cpu,
  globe: Globe,
};

export type PresetIconName = keyof typeof PRESET_ICONS;

interface IconPickerProps {
  value: string;
  onSelect: (iconName: string) => void;
  disabled?: boolean;
}

export function IconPicker({ value, onSelect, disabled }: IconPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (iconName: string) => {
    onSelect(iconName);
    setOpen(false);
  };

  const SelectedIcon = PRESET_ICONS[value] || Terminal;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon-sm" disabled={disabled} aria-label="Select icon">
          <SelectedIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-5 gap-1">
          {Object.entries(PRESET_ICONS).map(([name, Icon]) => (
            <Button
              key={name}
              variant="ghost"
              size="icon-sm"
              onClick={() => handleSelect(name)}
              className={cn('h-8 w-8', value === name && 'bg-accent text-accent-foreground')}
              aria-label={`Select ${name} icon`}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
