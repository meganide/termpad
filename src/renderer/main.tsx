import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
// Highlight.js theme for syntax highlighting in diff viewer
import 'highlight.js/styles/github-dark.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
