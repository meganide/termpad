import { describe, expect, it } from 'vitest';
import { normalizeBrowserAddress } from './browser';

describe('browser addresses', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['example.com:8443/path', 'https://example.com:8443/path'],
    [' https://example.com/path?q=1 ', 'https://example.com/path?q=1'],
    ['localhost:3000/path', 'http://localhost:3000/path'],
    ['127.0.0.1:5173', 'http://127.0.0.1:5173/'],
    ['[::1]:8080', 'http://[::1]:8080/'],
    ['http://localhost:3000', 'http://localhost:3000/'],
    ['file:///etc/passwd', null],
    ['javascript:alert(1)', null],
    ['data:text/html,test', null],
    ['not a url', null],
    ['', null],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeBrowserAddress(input)).toBe(expected);
  });
});
