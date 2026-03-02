import 'highlight.js/styles/github-dark.css';

import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './components/MessageBubble';
import { ThoughtBlock } from './components/ThoughtBlock';
import { ChatInput } from './components/ChatInput';
import type { ChatItem } from './types';

const mockMessages: ChatItem[] = [
  {
    type: 'message',
    role: 'user',
    content:
      'Can you help me set up a new React component for user authentication?',
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

export function ChatView() {
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ScrollArea className="flex-1 min-h-0" type="always">
        <div className="flex flex-col gap-4 p-4">
          {mockMessages.map((item, index) =>
            item.type === 'thought' ? (
              <ThoughtBlock key={index} data={item} />
            ) : (
              <MessageBubble key={index} message={item} />
            )
          )}
        </div>
      </ScrollArea>

      <ChatInput />
    </div>
  );
}
