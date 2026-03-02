import { Settings } from 'lucide-react';
import { Button } from './ui/button';

interface SettingsButtonProps {
  onClick: () => void;
  className?: string;
}

export function SettingsButton({ onClick, className }: SettingsButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={className}
      title="Settings"
      aria-label="Open settings"
    >
      <Settings className="h-4 w-4" />
    </Button>
  );
}
