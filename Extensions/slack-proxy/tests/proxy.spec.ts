/**
 * Proxy Agent Tests
 *
 * Tests for HTTP/WS proxy configuration and agent building.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  readProxyEnv,
  shouldBypassProxy,
  buildHttpAgent,
  buildWsAgent,
  getProxyInfo,
} from '../src/net/proxy.js';

describe('readProxyEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should read HTTP_PROXY', () => {
    process.env.HTTP_PROXY = 'http://proxy.example.com:8080';

    const env = readProxyEnv();

    expect(env.httpProxy).toBe('http://proxy.example.com:8080');
  });

  it('should read HTTPS_PROXY', () => {
    process.env.HTTPS_PROXY = 'https://secure-proxy.example.com:443';

    const env = readProxyEnv();

    expect(env.httpsProxy).toBe('https://secure-proxy.example.com:443');
  });

  it('should read NO_PROXY', () => {
    process.env.NO_PROXY = 'localhost,127.0.0.1,.internal.corp';

    const env = readProxyEnv();

    expect(env.noProxy).toBe('localhost,127.0.0.1,.internal.corp');
  });

  it('should prefer uppercase env vars over lowercase', () => {
    // Implementation: HTTP_PROXY || http_proxy (uppercase takes precedence)
    process.env.HTTP_PROXY = 'http://uppercase.example.com:8080';
    process.env.http_proxy = 'http://lowercase.example.com:8080';

    const env = readProxyEnv();

    expect(env.httpProxy).toBe('http://uppercase.example.com:8080');
  });

  it('should fallback to lowercase when uppercase not set', () => {
    delete process.env.HTTP_PROXY;
    process.env.http_proxy = 'http://lowercase.example.com:8080';

    const env = readProxyEnv();

    expect(env.httpProxy).toBe('http://lowercase.example.com:8080');
  });

  it('should return undefined for missing vars', () => {
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.NO_PROXY;
    delete process.env.no_proxy;

    const env = readProxyEnv();

    expect(env.httpProxy).toBeUndefined();
    expect(env.httpsProxy).toBeUndefined();
    expect(env.noProxy).toBeUndefined();
  });
});

describe('shouldBypassProxy', () => {
  it('should bypass localhost', () => {
    expect(shouldBypassProxy('localhost', 'localhost,127.0.0.1')).toBe(true);
  });

  it('should bypass 127.0.0.1', () => {
    expect(shouldBypassProxy('127.0.0.1', 'localhost,127.0.0.1')).toBe(true);
  });

  it('should bypass domain suffix', () => {
    expect(shouldBypassProxy('api.internal.corp', '.internal.corp')).toBe(true);
  });

  it('should not bypass non-matching hosts', () => {
    expect(shouldBypassProxy('external.com', 'localhost,127.0.0.1,.internal.corp')).toBe(false);
  });

  it('should return false when no_proxy is undefined', () => {
    expect(shouldBypassProxy('any.host.com', undefined)).toBe(false);
  });

  it('should handle wildcard *', () => {
    expect(shouldBypassProxy('any.host.com', '*')).toBe(true);
  });

  it('should match exact domain', () => {
    expect(shouldBypassProxy('example.com', 'example.com')).toBe(true);
  });

  it('should match subdomain when pattern has no leading dot', () => {
    expect(shouldBypassProxy('api.example.com', 'example.com')).toBe(true);
  });
});

describe('buildHttpAgent', () => {
  it('should return undefined without proxy config', () => {
    const agent = buildHttpAgent('https://api.example.com', {});

    expect(agent).toBeUndefined();
  });

  it('should return HttpsProxyAgent for https target with HTTPS_PROXY', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const agent = buildHttpAgent('https://api.example.com', {
      httpsProxy: 'https://proxy.example.com:443',
    });

    expect(agent).toBeDefined();
    expect(agent!.constructor.name).toBe('HttpsProxyAgent');

    consoleSpy.mockRestore();
  });

  it('should return HttpProxyAgent for http target with HTTP_PROXY', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const agent = buildHttpAgent('http://api.example.com', {
      httpProxy: 'http://proxy.example.com:8080',
    });

    expect(agent).toBeDefined();
    expect(agent!.constructor.name).toBe('HttpProxyAgent');

    consoleSpy.mockRestore();
  });

  it('should return undefined for invalid target URL', () => {
    const agent = buildHttpAgent('not-a-url', {
      httpsProxy: 'https://proxy.example.com:443',
    });

    expect(agent).toBeUndefined();
  });

  it('should bypass when host matches NO_PROXY', () => {
    const agent = buildHttpAgent('https://localhost:3000', {
      httpsProxy: 'https://proxy.example.com:443',
      noProxy: 'localhost,127.0.0.1',
    });

    expect(agent).toBeUndefined();
  });
});

describe('buildWsAgent', () => {
  it('should return undefined without proxy config', () => {
    const config = buildWsAgent('wss://gateway.example.com', {});

    expect(config).toBeUndefined();
  });

  it('should use httpsProxy for wss URLs', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const config = buildWsAgent('wss://gateway.example.com', {
      httpsProxy: 'https://proxy.example.com:443',
    });

    expect(config).toBeDefined();
    expect(config?.proxyUrl).toBe('https://proxy.example.com:443');

    consoleSpy.mockRestore();
  });

  it('should use httpProxy for ws URLs', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const config = buildWsAgent('ws://gateway.example.com', {
      httpProxy: 'http://proxy.example.com:8080',
    });

    expect(config).toBeDefined();
    expect(config?.proxyUrl).toBe('http://proxy.example.com:8080');

    consoleSpy.mockRestore();
  });

  it('should bypass when host matches NO_PROXY', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const config = buildWsAgent('wss://localhost:8080', {
      httpsProxy: 'https://proxy.example.com:443',
      noProxy: 'localhost',
    });

    expect(config).toBeUndefined();

    consoleSpy.mockRestore();
  });

  it('should include Proxy-Authorization header when auth provided', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const config = buildWsAgent('wss://gateway.example.com', {
      httpsProxy: 'https://user:password@proxy.example.com:443',
    });

    expect(config).toBeDefined();
    expect(config?.headers).toBeDefined();
    expect(config?.headers?.['Proxy-Authorization']).toMatch(/^Basic /);

    consoleSpy.mockRestore();
  });
});

describe('getProxyInfo', () => {
  it('should return masked proxy info', () => {
    const info = getProxyInfo({
      httpProxy: 'http://user:secret@proxy.example.com:8080',
      httpsProxy: 'https://proxy.example.com:443',
      noProxy: 'localhost',
    });

    expect(info.httpProxy).toContain('***');
    expect(info.httpProxy).not.toContain('secret');
    // Port 443 is default for https, so URL.toString() normalizes it away
    expect(info.httpsProxy).toBe('https://proxy.example.com/');
    expect(info.noProxy).toBe('localhost');
  });

  it('should return null for missing proxies', () => {
    const info = getProxyInfo({});

    expect(info.httpProxy).toBeNull();
    expect(info.httpsProxy).toBeNull();
    expect(info.noProxy).toBeNull();
  });
});
