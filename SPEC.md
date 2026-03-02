# Chat UI Specification - Phase 1 (Static Frontend)

## Overview

Create a static, non-functional Chat UI that replaces the existing `TaskView` component. This is a structured conversation log with message bubbles, collapsible thought blocks, and a floating command input with slash commands and mentions support. Test.

**Goal**: Create a visually complete static version that looks like it's working, with mock data demonstrating all visual states.

---

## Architecture

### File Structure

```
src/renderer/features/chat/
├── ChatView.tsx           # Main chat container component
├── components/
│   ├── MessageBubble.tsx  # User and AI message bubbles
│   ├── ThoughtBlock.tsx   # Collapsible thought/tool output blocks
│   ├── ChatInput.tsx      # Floating input bar with popovers
│   ├── SlashPopover.tsx   # Slash command dropdown
│   └── MentionPopover.tsx # Mention (@) dropdown
└── types.ts               # TypeScript interfaces
```

### Integration Point

- **Replace**: `src/renderer/features/workspace/TaskView.tsx`
- The `Layout.tsx` will render `ChatView` instead of `TaskView` in the main content area

---

## Design Specifications

### Color Palette

| Element      | Dark Mode                            | Light Mode           |
| ------------ | ------------------------------------ | -------------------- |
| Background   | `#020617` (Slate-950)                | `#f8fafc` (Slate-50) |
| AI Bubble    | `bg-muted/50` + `border-slate-800`   | White + `shadow-sm`  |
| User Bubble  | `bg-primary text-primary-foreground` | Same                 |
| Text (Light) | -                                    | `text-slate-900`     |

### Layout Specifications

| Element        | Tailwind Classes                                                |
| -------------- | --------------------------------------------------------------- |
| Chat Container | `flex-1 flex flex-col bg-background` (edge-to-edge, no padding) |
| Message Bubble | `rounded-xl p-4 max-w-[85%] text-sm leading-relaxed`            |
| AI Bubble      | `bg-muted/50 border border-border/50`                           |
| User Bubble    | `bg-primary text-primary-foreground`                            |
| Input Bar      | `sticky bottom-0 p-4 backdrop-blur-sm border border-border/50`  |
| Gradient Fade  | `h-16 bg-gradient-to-t from-background to-transparent`          |

### Message Alignment

- **User Messages**: Right-aligned (`justify-end`)
- **AI Messages**: Left-aligned (`justify-start`)
- **Both use**: `max-w-[85%]` (same width)
- **No avatars** - rely on position and color to differentiate
- **No grouping** - same spacing between all messages
- **No timestamps** - clean look without time indicators

---

## Components

### 1. ChatView (Main Container)

**Location**: `src/renderer/features/chat/ChatView.tsx`

**Structure**:

```
┌─────────────────────────────────┐
│     ScrollArea (flex-grow)      │
│  ┌───────────────────────────┐  │
│  │    Message Thread         │  │
│  │    - Message Bubbles      │  │
│  │    - Thought Blocks       │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  Gradient Fade (h-16)           │
├─────────────────────────────────┤
│  ChatInput (sticky bottom)      │
└─────────────────────────────────┘
```

**Implementation**:

```typescript
// src/renderer/features/chat/ChatView.tsx
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './components/MessageBubble';
import { ThoughtBlock } from './components/ThoughtBlock';
import { ChatInput } from './components/ChatInput';
import type { Message, ThoughtBlockData } from './types';

export function ChatView() {
  // Mock data defined inline (see Mock Data section)
  const messages: (Message | ThoughtBlockData)[] = [...];

  return (
    <div className="flex flex-col h-full bg-background">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">
          {messages.map((item, index) => (
            item.type === 'thought' ? (
              <ThoughtBlock key={index} data={item} />
            ) : (
              <MessageBubble key={index} message={item} />
            )
          ))}
        </div>
      </ScrollArea>

      {/* Gradient fade */}
      <div className="h-16 bg-gradient-to-t from-background to-transparent pointer-events-none -mt-16 relative z-10" />

      <ChatInput />
    </div>
  );
}
```

### 2. MessageBubble

**Location**: `src/renderer/features/chat/components/MessageBubble.tsx`

**Features**:

- Supports **full GFM markdown** using `react-markdown` with `rehype-highlight`
- User messages: right-aligned, `bg-primary text-primary-foreground`
- AI messages: left-aligned, `bg-muted/50 border border-border/50`
- Error state: Error icon + "Something went wrong" text
- Light mode: White background + `shadow-sm` for AI bubbles

**Implementation**:

```typescript
// src/renderer/features/chat/components/MessageBubble.tsx
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'rounded-xl p-4 max-w-[85%] text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/50 border border-border/50 dark:border-slate-800 light:bg-white light:shadow-sm',
          isError && 'border-destructive/50'
        )}
      >
        {isError ? (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Something went wrong</span>
          </div>
        ) : isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            className="prose prose-sm dark:prose-invert max-w-none"
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
```

### 3. ThoughtBlock (Collapsible)

**Location**: `src/renderer/features/chat/components/ThoughtBlock.tsx`

**Features**:

- Collapsed state: **Pulsing dot** (muted gray) + descriptive text (e.g., "Agent is analyzing project structure...")
- Chevron icon to expand/collapse
- Expanded content: **Scrollable terminal** style output
  - Dark background
  - Monospace font
  - Max-height with internal scroll for long outputs
  - No copy button

**Implementation**:

```typescript
// src/renderer/features/chat/components/ThoughtBlock.tsx
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ThoughtBlockData } from '../types';

interface ThoughtBlockProps {
  data: ThoughtBlockData;
}

export function ThoughtBlock({ data }: ThoughtBlockProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
        {/* Pulsing dot */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-muted-foreground/50 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/70" />
        </span>

        <span className="flex-1 text-left">{data.label}</span>

        <ChevronRight
          className={cn(
            'h-4 w-4 transition-transform',
            isOpen && 'rotate-90'
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-800 overflow-hidden">
          <div className="max-h-48 overflow-auto p-3">
            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
              {data.output}
            </pre>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### 4. ChatInput (Floating Input Bar)

**Location**: `src/renderer/features/chat/components/ChatInput.tsx`

**Features**:

- Floating pill-shaped design with:
  - Subtle border (`border-border/50`)
  - Backdrop blur (`backdrop-blur-sm`)
- Layout: `[textarea] [+] [send]` (Plus and Send both on right)
- Auto-resize textarea with **no max height** (grows freely)
- Model indicator: "Claude 3.5 Sonnet • 1,234 tokens" in corner
- Plus button: Opens attachment popover (using Shadcn Popover)
- Send button: Tooltip shows "Enter to send"
- Slash commands (`/`): Triggers `SlashPopover`
- Mentions (`@`): Triggers `MentionPopover`

**Implementation**:

```typescript
// src/renderer/features/chat/components/ChatInput.tsx
import { useState, useRef, useEffect } from 'react';
import { Send, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { SlashPopover } from './SlashPopover';
import { MentionPopover } from './MentionPopover';

export function ChatInput() {
  const [value, setValue] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea (no max height)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    // Check for triggers (static demo - just show popovers)
    const lastChar = newValue.slice(-1);
    setShowSlash(lastChar === '/');
    setShowMention(lastChar === '@');
  };

  return (
    <div className="sticky bottom-0 p-4">
      <div className="relative rounded-2xl border border-border/50 bg-background/80 backdrop-blur-sm p-2">
        {/* Model indicator */}
        <div className="absolute top-2 right-2 text-xs text-muted-foreground">
          Claude 3.5 Sonnet • 1,234 tokens
        </div>

        <div className="flex items-end gap-2 pt-4">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            placeholder="Message..."
            className="min-h-[40px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={1}
          />

          {/* Attachment button */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
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

          {/* Send button with tooltip */}
          <TooltipProvider>
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
          </TooltipProvider>
        </div>

        {/* Slash command popover */}
        <SlashPopover open={showSlash} onClose={() => setShowSlash(false)} />

        {/* Mention popover */}
        <MentionPopover open={showMention} onClose={() => setShowMention(false)} />
      </div>
    </div>
  );
}
```

### 5. SlashPopover

**Location**: `src/renderer/features/chat/components/SlashPopover.tsx`

**Features**:

- Floating dropdown above input
- Shows command + description
- Separate popover from MentionPopover (different styling/positioning)

**Implementation**:

```typescript
// src/renderer/features/chat/components/SlashPopover.tsx
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';

interface SlashPopoverProps {
  open: boolean;
  onClose: () => void;
}

const slashCommands = [
  { command: '/test', description: 'Run test suite' },
  { command: '/plan', description: 'Create implementation plan' },
  { command: '/revert', description: 'Revert last change' },
];

export function SlashPopover({ open, onClose }: SlashPopoverProps) {
  return (
    <Popover open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <PopoverAnchor className="absolute bottom-full left-4 mb-2" />
      <PopoverContent
        className="w-64 p-1"
        side="top"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid gap-1">
          {slashCommands.map((item) => (
            <button
              key={item.command}
              className="flex flex-col items-start rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={onClose}
            >
              <span className="font-medium">{item.command}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### 6. MentionPopover

**Location**: `src/renderer/features/chat/components/MentionPopover.tsx`

**Features**:

- Floating dropdown above input (separate from SlashPopover)
- **Flat list** - agents and files mixed together
- Different visual style from SlashPopover

**Implementation**:

```typescript
// src/renderer/features/chat/components/MentionPopover.tsx
import { Bot, FileCode } from 'lucide-react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';

interface MentionPopoverProps {
  open: boolean;
  onClose: () => void;
}

const mentions = [
  { name: '@agent-1', type: 'agent' as const },
  { name: '@agent-2', type: 'agent' as const },
  { name: '@main.ts', type: 'file' as const },
  { name: '@utils.ts', type: 'file' as const },
];

export function MentionPopover({ open, onClose }: MentionPopoverProps) {
  return (
    <Popover open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <PopoverAnchor className="absolute bottom-full left-4 mb-2" />
      <PopoverContent
        className="w-56 p-1"
        side="top"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid gap-1">
          {mentions.map((item) => (
            <button
              key={item.name}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={onClose}
            >
              {item.type === 'agent' ? (
                <Bot className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileCode className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

## Types

**Location**: `src/renderer/features/chat/types.ts`

```typescript
// src/renderer/features/chat/types.ts

export interface Message {
  type: 'message';
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
}

export interface ThoughtBlockData {
  type: 'thought';
  label: string;
  output: string;
}

export type ChatItem = Message | ThoughtBlockData;
```

---

## Mock Data (15+ Messages)

The mock data should be defined inline in `ChatView.tsx`:

```typescript
const mockMessages: ChatItem[] = [
  {
    type: 'message',
    role: 'user',
    content: 'Can you help me set up a new React component for user authentication?',
  },
  {
    type: 'message',
    role: 'assistant',
    content: `Of course! I'll help you create an authentication component. Let me first check your project structure to understand the existing patterns.`,
  },
  {
    type: 'thought',
    label: 'Agent is analyzing project structure...',
    output: `$ ls -la src/components/
total 24
drwxr-xr-x  6 user user 4096 Jan 15 10:30 .
drwxr-xr-x 12 user user 4096 Jan 15 10:30 ..
-rw-r--r--  1 user user 1234 Jan 15 10:30 Button.tsx
-rw-r--r--  1 user user 2345 Jan 15 10:30 Input.tsx
-rw-r--r--  1 user user 3456 Jan 15 10:30 Layout.tsx
drwxr-xr-x  2 user user 4096 Jan 15 10:30 ui`,
  },
  {
    type: 'message',
    role: 'assistant',
    content: `I can see you're using a standard component structure. Here's what I'll create:

## Authentication Component

\`\`\`typescript
import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface AuthFormProps {
  onSubmit: (email: string, password: string) => void;
}

export function AuthForm({ onSubmit }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSubmit(email, password);
    }}>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <Button type="submit">Sign In</Button>
    </form>
  );
}
\`\`\`

This includes:
- **Email validation** via HTML5 type attribute
- **Password field** with proper masking
- **Form submission** handler prop`,
  },
  {
    type: 'message',
    role: 'user',
    content: 'Can you add form validation with error messages?',
  },
  {
    type: 'thought',
    label: 'Agent is searching for validation patterns...',
    output: `$ grep -r "validation" src/
src/utils/validate.ts:export function validateEmail(email: string)
src/utils/validate.ts:export function validatePassword(password: string)
src/hooks/useForm.ts:  const [validationErrors, setValidationErrors]`,
  },
  {
    type: 'message',
    role: 'assistant',
    content: `Great idea! I found you already have validation utilities. Here's the updated component:

\`\`\`typescript
import { useState } from 'react';
import { validateEmail, validatePassword } from '../utils/validate';

export function AuthForm({ onSubmit }: AuthFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!validatePassword(password)) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (Object.keys(newErrors).length === 0) {
      onSubmit(email, password);
    } else {
      setErrors(newErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... inputs with error display */}
    </form>
  );
}
\`\`\``,
  },
  {
    type: 'message',
    role: 'user',
    content: 'What about adding OAuth support?',
  },
  {
    type: 'message',
    role: 'assistant',
    content: `For OAuth, I'd recommend using a library like **next-auth** or **@auth/core**. Here's how we'd structure it:

1. Add OAuth providers configuration
2. Create social login buttons
3. Handle the OAuth callback

Would you like me to implement this?`,
  },
  {
    type: 'message',
    role: 'user',
    content: 'Yes, please add Google and GitHub OAuth',
  },
  {
    type: 'thought',
    label: 'Agent is checking dependencies...',
    output: `$ cat package.json | grep -A5 "dependencies"
"dependencies": {
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "lucide-react": "^0.263.0"
}`,
  },
  {
    type: 'message',
    role: 'assistant',
    isError: true,
    content: '',
  },
  {
    type: 'message',
    role: 'user',
    content: 'What happened?',
  },
  {
    type: 'message',
    role: 'assistant',
    content: `Sorry about that! Let me try again. I'll add the OAuth configuration:

\`\`\`typescript
// src/config/auth.ts
export const authConfig = {
  providers: [
    {
      id: 'google',
      name: 'Google',
      clientId: process.env.GOOGLE_CLIENT_ID,
    },
    {
      id: 'github',
      name: 'GitHub',
      clientId: process.env.GITHUB_CLIENT_ID,
    },
  ],
};
\`\`\`

And the social buttons component:

\`\`\`typescript
// src/components/SocialAuth.tsx
import { Github } from 'lucide-react';

export function SocialAuth() {
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={() => signIn('google')}>
        Continue with Google
      </Button>
      <Button variant="outline" onClick={() => signIn('github')}>
        <Github className="mr-2 h-4 w-4" />
        Continue with GitHub
      </Button>
    </div>
  );
}
\`\`\``,
  },
  {
    type: 'message',
    role: 'user',
    content: 'Perfect! Can you also add a "Remember me" checkbox?',
  },
  {
    type: 'message',
    role: 'assistant',
    content: `Here's the checkbox addition:

\`\`\`typescript
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

// Inside the form:
<div className="flex items-center gap-2">
  <Checkbox
    id="remember"
    checked={rememberMe}
    onCheckedChange={setRememberMe}
  />
  <Label htmlFor="remember">Remember me</Label>
</div>
\`\`\`

This will persist the session for 30 days instead of the default session duration.`,
  },
];
```

---

## Scrollbar Styling

The spec requires a thin "Ghost" style scrollbar that is **always visible**.

Add to global CSS or the ScrollArea component:

```css
/* For the ghost scrollbar - always visible */
[data-slot='scroll-area-scrollbar'] {
  width: 6px !important;
}

[data-slot='scroll-area-thumb'] {
  background: rgba(255, 255, 255, 0.1) !important;
}

.light [data-slot='scroll-area-thumb'] {
  background: rgba(0, 0, 0, 0.1) !important;
}
```

---

## Dependencies to Install

```bash
npm install react-markdown rehype-highlight
npm install -D @types/react-markdown
```

Also need highlight.js CSS for syntax highlighting:

```typescript
// In ChatView.tsx or main.tsx
import 'highlight.js/styles/github-dark.css';
```

---

## Tasks Breakdown

### Phase 1: Setup & Types

- [ ] Create feature folder structure
  - Create `src/renderer/features/chat/` directory
  - Create `components/` subdirectory
  - Files: `mkdir -p src/renderer/features/chat/components`
  - Dependencies: None
  - Testing: Verify folders exist
  - Acceptance: Directory structure matches spec

- [ ] Define TypeScript types
  - Implementation:

    ```typescript
    // src/renderer/features/chat/types.ts
    export interface Message {
      type: 'message';
      role: 'user' | 'assistant';
      content: string;
      isError?: boolean;
    }

    export interface ThoughtBlockData {
      type: 'thought';
      label: string;
      output: string;
    }

    export type ChatItem = Message | ThoughtBlockData;
    ```

  - Files: `src/renderer/features/chat/types.ts`
  - Dependencies: None
  - Testing: TypeScript compilation passes
  - Acceptance: Types are exported and usable

### Phase 2: Install Dependencies

- [ ] Install markdown dependencies
  - Run: `npm install react-markdown rehype-highlight`
  - Files: `package.json`
  - Dependencies: None
  - Testing: `npm ls react-markdown rehype-highlight`
  - Acceptance: Packages installed without errors

### Phase 3: Core Components

- [ ] Create MessageBubble component
  - Implementation: See MessageBubble section above
  - Features:
    - User message styling (right-aligned, primary color)
    - AI message styling (left-aligned, muted background)
    - Full GFM markdown support via react-markdown
    - Syntax highlighting via rehype-highlight
    - Error state with AlertCircle icon
  - Files: `src/renderer/features/chat/components/MessageBubble.tsx`
  - Dependencies: types.ts, react-markdown, rehype-highlight, lucide-react
  - Testing: Component renders without errors, markdown renders correctly
  - Acceptance: Both message types display correctly, error state shows icon

- [ ] Create ThoughtBlock component
  - Implementation: See ThoughtBlock section above
  - Features:
    - Pulsing muted gray dot animation
    - Collapsible with chevron rotation
    - Scrollable terminal output (max-h-48)
    - Dark background terminal styling
  - Files: `src/renderer/features/chat/components/ThoughtBlock.tsx`
  - Dependencies: types.ts, @/components/ui/collapsible, lucide-react
  - Testing: Collapse/expand works, animation runs
  - Acceptance: Pulsing dot visible, terminal scrolls for long content

- [ ] Create SlashPopover component
  - Implementation: See SlashPopover section above
  - Features:
    - Three commands: /test, /plan, /revert
    - Command + description layout
    - Floating above input
  - Files: `src/renderer/features/chat/components/SlashPopover.tsx`
  - Dependencies: @/components/ui/popover
  - Testing: Popover opens/closes, items clickable
  - Acceptance: Shows above input with correct styling

- [ ] Create MentionPopover component
  - Implementation: See MentionPopover section above
  - Features:
    - Flat list of agents and files
    - Bot/FileCode icons
    - Different styling from SlashPopover
  - Files: `src/renderer/features/chat/components/MentionPopover.tsx`
  - Dependencies: @/components/ui/popover, lucide-react
  - Testing: Popover opens/closes, items clickable
  - Acceptance: Icons display correctly, flat list layout

- [ ] Create ChatInput component
  - Implementation: See ChatInput section above
  - Features:
    - Floating pill design with subtle border
    - Backdrop blur (sm)
    - Auto-resize textarea (no max height)
    - Plus button with attachment popover
    - Send button with "Enter to send" tooltip
    - Model indicator "Claude 3.5 Sonnet • 1,234 tokens"
    - Slash/Mention popover triggers
  - Files: `src/renderer/features/chat/components/ChatInput.tsx`
  - Dependencies: SlashPopover, MentionPopover, Shadcn components
  - Testing: Textarea grows, popovers trigger, tooltip shows
  - Acceptance: All interactive elements work, layout matches spec

### Phase 4: Main Container

- [ ] Create ChatView main component
  - Implementation: See ChatView section above
  - Features:
    - ScrollArea for message thread
    - Edge-to-edge layout (no padding on container)
    - 64px gradient fade
    - Mock data inline (15+ messages)
    - Renders MessageBubble and ThoughtBlock
  - Files: `src/renderer/features/chat/ChatView.tsx`
  - Dependencies: All chat components, ScrollArea
  - Testing: Scrolling works, all message types render
  - Acceptance: Full conversation visible, gradient fade works

### Phase 5: Integration

- [ ] Update Layout to use ChatView
  - Modify Layout.tsx to import and render ChatView instead of TaskView
  - Implementation:

    ```typescript
    // src/renderer/components/Layout.tsx
    import { ChatView } from '../features/chat/ChatView';

    // Replace <TaskView tabId={activeTab} /> with:
    <ChatView />
    ```

  - Files: `src/renderer/components/Layout.tsx`
  - Dependencies: ChatView component complete
  - Testing: App renders ChatView in main area
  - Acceptance: Chat UI visible when app loads

### Phase 6: Styling Polish

- [ ] Add ghost scrollbar styling
  - Add CSS for thin always-visible scrollbar
  - Implementation: See Scrollbar Styling section
  - Files: Global CSS or ScrollArea customization
  - Dependencies: None
  - Testing: Scrollbar visible in both themes
  - Acceptance: Thin ghost scrollbar always visible

- [ ] Add highlight.js CSS import
  - Import github-dark theme for code blocks
  - Implementation: `import 'highlight.js/styles/github-dark.css';`
  - Files: `src/renderer/features/chat/ChatView.tsx` or `main.tsx`
  - Dependencies: rehype-highlight installed
  - Testing: Code blocks have syntax colors
  - Acceptance: TypeScript/JavaScript code highlighted

- [ ] Verify dark/light mode styling
  - Test all components in both themes
  - Check: AI bubble shadow in light mode, borders in dark mode
  - Files: All chat components
  - Dependencies: All components complete
  - Testing: Toggle theme, verify all elements
  - Acceptance: Both themes match spec colors

### Phase 7: Final Verification

- [ ] Run build and type check
  - Run: `npm run lint && tsc --noEmit`
  - Files: All
  - Dependencies: All tasks complete
  - Testing: No errors
  - Acceptance: Clean build

- [ ] Manual visual verification
  - Check all elements match design spec
  - Verify responsive behavior
  - Test all interactive elements
  - Files: None (visual check)
  - Dependencies: Build passes
  - Testing: Manual testing
  - Acceptance: UI matches all spec requirements

---

## Summary of Decisions

| Decision                | Choice                            |
| ----------------------- | --------------------------------- |
| Placement               | Replace TaskView                  |
| Tool Call Card buttons  | Skip for now                      |
| Thought block indicator | Pulsing dot + text                |
| Autocomplete            | Floating dropdown                 |
| Mock data amount        | Rich (15+ messages)               |
| Input layout            | `[textarea] [+] [send]`           |
| Model indicator         | Both (model + tokens)             |
| Scrollbar               | Always visible ghost style        |
| Terminal output style   | Scrollable terminal               |
| Input border            | Subtle border + backdrop blur     |
| Popovers                | Separate for slash and mentions   |
| Markdown                | Full GFM with react-markdown      |
| Bubble width            | Same 85% for both                 |
| Pulsing dot color       | Muted gray                        |
| Container padding       | Edge-to-edge                      |
| Textarea max height     | No max (grows freely)             |
| File structure          | Feature folder                    |
| Mock data location      | Inline in component               |
| Markdown library        | react-markdown + rehype-highlight |
| Avatars                 | None                              |
| Slash command detail    | Command + description             |
| Mention sections        | Flat list                         |
| Copy button on terminal | No                                |
| Timestamps              | None                              |
| Blur intensity          | Subtle (sm)                       |
| Gradient height         | Medium (64px)                     |
| Keyboard hints          | Tooltip on send button            |
| Error states            | One error example included        |
| Error styling           | Error icon + text                 |
| Message grouping        | No grouping                       |
