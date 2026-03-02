import { Layout } from './components/Layout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export function App() {
  // Enable global keyboard shortcuts for navigation
  useKeyboardShortcuts();

  return <Layout />;
}
