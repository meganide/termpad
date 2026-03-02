import { describe, it, expect } from 'vitest';
import {
  highlightCode,
  highlightLine,
  getLanguageFromPath,
  escapeHtml,
  isLanguageSupported,
  getSupportedExtensions,
} from './highlight';

describe('highlight utilities', () => {
  describe('getLanguageFromPath', () => {
    it('should return typescript for .ts files', () => {
      expect(getLanguageFromPath('src/file.ts')).toBe('typescript');
    });

    it('should return typescript for .tsx files', () => {
      expect(getLanguageFromPath('components/Button.tsx')).toBe('typescript');
    });

    it('should return javascript for .js files', () => {
      expect(getLanguageFromPath('scripts/build.js')).toBe('javascript');
    });

    it('should return javascript for .jsx files', () => {
      expect(getLanguageFromPath('components/App.jsx')).toBe('javascript');
    });

    it('should return python for .py files', () => {
      expect(getLanguageFromPath('scripts/main.py')).toBe('python');
    });

    it('should return go for .go files', () => {
      expect(getLanguageFromPath('cmd/main.go')).toBe('go');
    });

    it('should return rust for .rs files', () => {
      expect(getLanguageFromPath('src/lib.rs')).toBe('rust');
    });

    it('should return json for .json files', () => {
      expect(getLanguageFromPath('package.json')).toBe('json');
    });

    it('should return css for .css files', () => {
      expect(getLanguageFromPath('styles/main.css')).toBe('css');
    });

    it('should return html for .html files', () => {
      expect(getLanguageFromPath('public/index.html')).toBe('html');
    });

    it('should return markdown for .md files', () => {
      expect(getLanguageFromPath('README.md')).toBe('markdown');
    });

    it('should return yaml for .yaml files', () => {
      expect(getLanguageFromPath('config.yaml')).toBe('yaml');
    });

    it('should return yaml for .yml files', () => {
      expect(getLanguageFromPath('.github/workflows/ci.yml')).toBe('yaml');
    });

    it('should return bash for .sh files', () => {
      expect(getLanguageFromPath('scripts/deploy.sh')).toBe('bash');
    });

    it('should return undefined for unknown extensions', () => {
      expect(getLanguageFromPath('file.unknown')).toBeUndefined();
    });

    it('should handle files without extensions', () => {
      expect(getLanguageFromPath('Dockerfile')).toBeUndefined();
    });

    it('should handle paths with multiple dots', () => {
      expect(getLanguageFromPath('src/component.test.ts')).toBe('typescript');
    });

    it('should be case-insensitive', () => {
      expect(getLanguageFromPath('file.TS')).toBe('typescript');
      expect(getLanguageFromPath('file.Tsx')).toBe('typescript');
    });
  });

  describe('highlightCode', () => {
    it('should highlight TypeScript code', () => {
      const code = 'const x: number = 1;';
      const result = highlightCode(code, 'typescript');
      expect(result).toContain('hljs-');
      expect(result).toContain('const');
    });

    it('should highlight JavaScript code', () => {
      const code = 'function hello() { return "world"; }';
      const result = highlightCode(code, 'javascript');
      expect(result).toContain('hljs-');
      expect(result).toContain('function');
    });

    it('should highlight Python code', () => {
      const code = 'def hello(): return "world"';
      const result = highlightCode(code, 'python');
      expect(result).toContain('hljs-');
    });

    it('should handle unknown languages gracefully', () => {
      const code = 'some code';
      const result = highlightCode(code, 'nonexistent-language');
      // Should still return something (auto-detected or escaped)
      expect(result).toBeTruthy();
    });

    it('should auto-detect language when not specified', () => {
      const code = 'const x = 1;';
      const result = highlightCode(code);
      expect(result).toBeTruthy();
    });

    it('should return empty string for empty input', () => {
      expect(highlightCode('')).toBe('');
    });

    it('should handle code with special characters', () => {
      const code = '<div class="test">Hello & World</div>';
      const result = highlightCode(code, 'html');
      expect(result).toBeTruthy();
    });
  });

  describe('highlightLine', () => {
    it('should highlight a single line', () => {
      const line = 'const x = 1;';
      const result = highlightLine(line, 'typescript');
      expect(result).toContain('hljs-');
    });

    it('should handle empty lines', () => {
      expect(highlightLine('')).toBe('');
    });
  });

  describe('escapeHtml', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should escape less than', () => {
      expect(escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('should escape greater than', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('a "b" c')).toBe('a &quot;b&quot; c');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("a 'b' c")).toBe('a &#039;b&#039; c');
    });

    it('should handle HTML tags', () => {
      expect(escapeHtml('<div class="test">')).toBe('&lt;div class=&quot;test&quot;&gt;');
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('typescript')).toBe(true);
      expect(isLanguageSupported('javascript')).toBe(true);
      expect(isLanguageSupported('python')).toBe(true);
      expect(isLanguageSupported('go')).toBe(true);
      expect(isLanguageSupported('rust')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('nonexistent')).toBe(false);
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return array of extensions', () => {
      const extensions = getSupportedExtensions();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should include common extensions', () => {
      const extensions = getSupportedExtensions();
      expect(extensions).toContain('ts');
      expect(extensions).toContain('tsx');
      expect(extensions).toContain('js');
      expect(extensions).toContain('py');
      expect(extensions).toContain('go');
      expect(extensions).toContain('rs');
    });
  });
});
