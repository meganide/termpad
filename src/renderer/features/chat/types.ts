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
