import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { useAppStore } from '../stores/appStore';

export function NotificationSettings() {
  const { settings, updateSettings } = useAppStore();
  const { notifications } = settings;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="notifications-enabled">Enable notifications</Label>
          <p className="text-sm text-muted-foreground">
            Show desktop notifications when terminal status changes
          </p>
        </div>
        <Switch
          id="notifications-enabled"
          checked={notifications.enabled}
          onCheckedChange={(checked) =>
            updateSettings({
              notifications: { ...notifications, enabled: checked },
            })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="background-only">Only when in background</Label>
          <p className="text-sm text-muted-foreground">
            Only show notifications when the window is not focused
          </p>
        </div>
        <Switch
          id="background-only"
          checked={notifications.backgroundOnly}
          onCheckedChange={(checked) =>
            updateSettings({
              notifications: { ...notifications, backgroundOnly: checked },
            })
          }
          disabled={!notifications.enabled}
        />
      </div>
    </div>
  );
}
