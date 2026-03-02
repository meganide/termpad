import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import scala from 'highlight.js/lib/languages/scala';

// Register languages
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('scala', scala);

// Map file extensions to language identifiers
const extensionToLanguage: Record<string, string> = {
  // TypeScript/JavaScript
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',

  // Python
  py: 'python',
  pyi: 'python',
  pyw: 'python',

  // Go
  go: 'go',

  // Rust
  rs: 'rust',

  // Web
  json: 'json',
  css: 'css',
  scss: 'css',
  less: 'css',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',

  // Config
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'yaml',

  // Shell
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',

  // SQL
  sql: 'sql',

  // JVM
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  sc: 'scala',

  // .NET
  cs: 'csharp',
  fs: 'csharp',

  // C/C++
  c: 'cpp',
  h: 'cpp',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',

  // Other
  php: 'php',
  rb: 'ruby',
  swift: 'swift',
  md: 'markdown',
  markdown: 'markdown',
};

/**
 * Get the highlight.js language identifier from a file path.
 */
export function getLanguageFromPath(filePath: string): string | undefined {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  return extensionToLanguage[ext];
}

/**
 * Highlight code using highlight.js.
 * Returns HTML string with highlighting spans.
 */
export function highlightCode(code: string, language?: string): string {
  if (!code) return '';

  try {
    if (language && hljs.getLanguage(language)) {
      const result = hljs.highlight(code, { language });
      return result.value;
    }

    // Try auto-detection if no language specified
    const result = hljs.highlightAuto(code);
    return result.value;
  } catch {
    // Return escaped HTML if highlighting fails
    return escapeHtml(code);
  }
}

/**
 * Highlight a single line of code.
 * Ensures the highlight state is not carried between lines.
 */
export function highlightLine(line: string, language?: string): string {
  return highlightCode(line, language);
}

/**
 * Escape HTML special characters.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if a language is supported.
 */
export function isLanguageSupported(language: string): boolean {
  return !!hljs.getLanguage(language);
}

/**
 * Get list of supported file extensions.
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(extensionToLanguage);
}
