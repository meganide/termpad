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
      <div className="w-44 shrink-0 flex flex-col border-r border-border/60 bg-sidebar-panel">
        <div className="px-5 pt-6 pb-4 eyebrow">Preferences</div>
        <nav aria-label="Settings" className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary shadow-[inset_2px_0_0_var(--primary)]'
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
      <div className="min-w-0 flex-1 p-6 lg:p-10 overflow-y-auto bg-background">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 border-b border-border/60 pb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-2 text-sm text-muted-foreground">Make this workspace your own.</p>
          </div>

          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'terminal' && <TerminalSettings />}
          {activeTab === 'shortcuts' && <ShortcutsSettings />}
        </div>
      </div>
    </div>
  );
}
