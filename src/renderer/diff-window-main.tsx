import React from 'react';
import ReactDOM from 'react-dom/client';
import { DiffWindowApp } from './DiffWindowApp';
import './index.css';
// Highlight.js theme for syntax highlighting in diff viewer
import 'highlight.js/styles/github-dark.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DiffWindowApp />
  </React.StrictMode>
);
