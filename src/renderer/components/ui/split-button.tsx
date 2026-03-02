import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { cn } from '@/lib/utils';

export interface SplitButtonItem {
  id: string;
  label: string;
  selected?: boolean;
}

export interface SplitButtonProps {
  /** Main button label (fixed) */
  label: string;
  /** Optional icon to display before the label */
  icon?: React.ReactNode;
  /** Called when main button is clicked */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether the dropdown arrow is disabled (independent of main button) */
  dropdownDisabled?: boolean;
  /** Dropdown items */
  items: SplitButtonItem[];
  /** Called when an item is selected (does NOT auto-run onClick) */
  onItemSelect: (id: string) => void;
  /** Show checkmark next to selected item (default: true) */
  showCheckmark?: boolean;
  /** Additional class names for the container */
  className?: string;
}

export function SplitButton({
  label,
  icon,
  onClick,
  disabled = false,
  dropdownDisabled = false,
  items,
  onItemSelect,
  showCheckmark = true,
  className,
}: SplitButtonProps) {
  return (
    <div className={cn('flex items-center', className)} data-testid="split-button">
      <Button
        variant="outline"
        size="sm"
        className="rounded-r-none border-r-0"
        disabled={disabled}
        onClick={onClick}
        data-testid="split-button-main"
      >
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="rounded-l-none px-2"
            disabled={disabled || dropdownDisabled}
            data-testid="split-button-dropdown"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => onItemSelect(item.id)}
              data-testid={`split-button-item-${item.id}`}
            >
              {showCheckmark && (
                <span className="w-4 mr-1 flex items-center justify-center">
                  {item.selected && <Check className="h-4 w-4" />}
                </span>
              )}
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
