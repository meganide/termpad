import { ChevronDown } from 'lucide-react';

interface BranchSelectorProps {
  label: string;
  value: string;
  branches: string[];
  onChange: (branch: string) => void;
  disabled?: boolean;
}

export function BranchSelector({
  label,
  value,
  branches,
  onChange,
  disabled = false,
}: BranchSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-7 px-2 pr-6 text-sm rounded border border-input bg-transparent appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`branch-selector-${label.toLowerCase()}`}
        >
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground" />
      </div>
    </div>
  );
}
