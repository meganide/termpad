import { useAutoUpdater } from '../hooks/useAutoUpdater';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Download, RefreshCw, X, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

const RELEASES_URL = 'https://github.com/meganide/termpad/releases/latest';

export function UpdateNotification() {
  const {
    status,
    isUpdateAvailable,
    isDownloading,
    isUpdateReady,
    isChecking,
    hasError,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
    checkForUpdates,
  } = useAutoUpdater();

  const openReleasesPage = () => {
    window.electronAPI.openExternal(RELEASES_URL);
  };

  // Don't render anything if no update notification needed
  if (status.status === 'idle' && !hasError) {
    return null;
  }

  // Checking for updates
  if (isChecking) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-card rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.25)] p-4 max-w-sm animate-in slide-in-from-bottom-2">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          <span className="text-sm">Checking for updates...</span>
        </div>
      </div>
    );
  }

  // Update available - manual download for unsupported install types (.deb/.rpm)
  if (isUpdateAvailable && !status.supportsAutoUpdate) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-card rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.25)] p-4 max-w-sm animate-in slide-in-from-bottom-2">
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Update Available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Version {status.availableVersion} is available. Download the latest version manually.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={openReleasesPage}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Download
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissUpdate}>
                Later
              </Button>
            </div>
          </div>
          <button
            onClick={dismissUpdate}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Update available - prompt to download
  if (isUpdateAvailable) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-card rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.25)] p-4 max-w-sm animate-in slide-in-from-bottom-2">
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Update Available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Version {status.availableVersion} is ready to download
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={downloadUpdate}>
                Download
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissUpdate}>
                Later
              </Button>
            </div>
          </div>
          <button
            onClick={dismissUpdate}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Downloading update
  if (isDownloading && status.progress) {
    const percent = Math.round(status.progress.percent);
    const speedMB = (status.progress.bytesPerSecond / 1024 / 1024).toFixed(1);

    return (
      <div className="fixed bottom-4 right-4 z-50 bg-card rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.25)] p-4 max-w-sm animate-in slide-in-from-bottom-2">
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 text-primary mt-0.5 flex-shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Downloading Update</p>
            <p className="text-sm text-muted-foreground mt-1">
              {percent}% • {speedMB} MB/s
            </p>
            <Progress value={percent} className="mt-2" />
          </div>
        </div>
      </div>
    );
  }

  // Update ready to install
  if (isUpdateReady) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-card rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.25)] p-4 max-w-sm animate-in slide-in-from-bottom-2">
        <div className="flex items-start gap-3">
          <RefreshCw className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Update Ready</p>
            <p className="text-sm text-muted-foreground mt-1">
              Restart to apply version {status.availableVersion}
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={installUpdate}>
                Restart Now
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissUpdate}>
                Later
              </Button>
            </div>
          </div>
          <button
            onClick={dismissUpdate}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-card rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.25)] p-4 max-w-sm animate-in slide-in-from-bottom-2">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Update Failed</p>
            <p className="text-sm text-muted-foreground mt-1">{status.error}</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={checkForUpdates}>
                Retry
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissUpdate}>
                Dismiss
              </Button>
            </div>
          </div>
          <button
            onClick={dismissUpdate}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
