import { useState } from 'react';
import { X, MessageSquarePlus, Copy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReviewOnboardingProps {
  hasComments: boolean;
}

const STORAGE_KEY = 'review-onboarding-dismissed';

function getInitialDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function ReviewOnboarding({ hasComments }: ReviewOnboardingProps) {
  const [isDismissed, setIsDismissed] = useState(getInitialDismissed);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsDismissed(true);
  };

  // Don't show if dismissed or if user already has comments (they know how to use it)
  if (isDismissed || hasComments) {
    return null;
  }

  return (
    <div
      className="mb-4 p-4 rounded-lg border border-border bg-muted/50"
      data-testid="review-onboarding"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Local PR Review</h3>
          </div>

          <p className="text-sm text-muted-foreground">
            Review your changes before committing. Add comments that you can copy and paste to your
            LLM to fix issues directly.
          </p>

          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-medium">
                1
              </div>
              <MessageSquarePlus className="h-3.5 w-3.5" />
              <span>Click on any line to add a review comment</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-medium">
                2
              </div>
              <Copy className="h-3.5 w-3.5" />
              <span>Use the Copy button in the header to copy all comments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-medium">
                3
              </div>
              <Sparkles className="h-3.5 w-3.5" />
              <span>Paste into your LLM to have it fix the issues for you</span>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mt-1 -mr-1"
          onClick={handleDismiss}
          data-testid="dismiss-onboarding"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
