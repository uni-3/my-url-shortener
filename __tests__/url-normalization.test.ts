import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../lib/utils/url';

describe('normalizeUrl', () => {
  it('should add a trailing slash to the root domain', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
  });

  it('should keep existing trailing slash on root domain', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('should remove /index.html from the root', () => {
    expect(normalizeUrl('https://example.com/index.html')).toBe('https://example.com/');
  });

  it('should remove /index.html from a path', () => {
    expect(normalizeUrl('https://example.com/foo/index.html')).toBe('https://example.com/foo/');
  });

  it('should not remove index.html if it is part of a filename but not the full name', () => {
    expect(normalizeUrl('https://example.com/my-index.html')).toBe('https://example.com/my-index.html');
  });

  it('should handle query parameters correctly while removing /index.html', () => {
    expect(normalizeUrl('https://example.com/index.html?query=1')).toBe('https://example.com/?query=1');
  });

  it('should handle fragments correctly while removing /index.html', () => {
    expect(normalizeUrl('https://example.com/index.html#hash')).toBe('https://example.com/#hash');
  });

  it('should lowercase the hostname', () => {
    expect(normalizeUrl('HTTPS://EXAMPLE.COM/')).toBe('https://example.com/');
  });

  it('should return the original string if URL is invalid', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });

  it('should handle complex cases', () => {
    expect(normalizeUrl('HTTPS://EXAMPLE.COM:443/foo/bar/index.html?a=b#c'))
      .toBe('https://example.com/foo/bar/?a=b#c');
  });
});
