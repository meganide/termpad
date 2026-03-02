import { useState, useEffect } from 'react';
import { Bell, Keyboard, ArrowLeft, Terminal } from 'lucide-react';
import { NotificationSettings } from './NotificationSettings';
import { ShortcutsSettings } from './ShortcutsSettings';
import { TerminalSettings } from './TerminalSettings';

export type SettingsTab = 'notifications' | 'terminal' | 'shortcuts';

interface SettingsScreenProps {
  onBack: () => void;
  initialTab?: SettingsTab;
}

const navItems: { id: SettingsTab; label: string; icon: typeof Bell }[] = [
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
];

export function SettingsScreen({ onBack, initialTab = 'terminal' }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Update active tab when initialTab prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="flex-1 flex bg-background h-full">
      {/* Left navigation panel */}
      <div className="w-48 flex flex-col bg-sidebar-panel">
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Back button at bottom - matches Sidebar footer height */}
        <div className="flex items-center px-3 py-2.5 bg-sidebar-panel">
          <button
            onClick={onBack}
            className="flex-1 h-9 flex items-center justify-start gap-2 px-3 rounded-md text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex-1 p-6 overflow-y-auto bg-background">
        <div className="max-w-xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>

          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'terminal' && <TerminalSettings />}
          {activeTab === 'shortcuts' && <ShortcutsSettings />}
        </div>
      </div>
    </div>
  );
}
