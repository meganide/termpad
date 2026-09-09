export const BROWSER_PARTITION = 'persist:termpad-browser';

export function isBrowserUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeBrowserAddress(value: string): string | null {
  const address = value.trim();
  if (!address) return null;
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(?=[:/]|$)/i.test(address);
  const hostWithPort = /^[^/:\s]+:\d+(?:[/?#]|$)/.test(address);
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(address) && !hostWithPort;
  const url = local ? `http://${address}` : hasScheme ? address : `https://${address}`;
  return isBrowserUrl(url) ? new URL(url).href : null;
}
