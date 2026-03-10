/**
 * AGE Job Client
 *
 * HTTP client for AGE Job API (PR#3).
 * Respects HTTP(S)_PROXY environment variables.
 */

import type { AgeJobStatus, AgeJobResult } from './types';

export interface AgeClientConfig {
  baseUrl: string; // e.g., http://localhost:8765
  timeoutMs: number;
}

/**
 * Get proxy agent if HTTP(S)_PROXY is set.
 * Returns undefined if no proxy is configured.
 */
function getProxyUrl(): string | undefined {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy
  );
}

/**
 * Make HTTP request with optional proxy support.
 */
async function fetchWithProxy(
  url: string,
  options: RequestInit & { timeout?: number }
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = options.timeout
    ? setTimeout(() => controller.abort(), options.timeout)
    : undefined;

  try {
    // Note: Node.js 18+ fetch doesn't natively support proxy
    // For production, use undici or node-fetch with proxy-agent
    // For M0, we rely on environment-level proxy (e.g., proxychains)
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Create a new job in AGE.
 */
export async function ageCreateJob(
  cfg: AgeClientConfig,
  input: {
    trace_id: string;
    capability: 'amazon://strategy/wasted-spend-detect';
    arguments: Record<string, unknown>;
  }
): Promise<{ job_id: string }> {
  const url = `${cfg.baseUrl}/v1/jobs`;

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    timeout: cfg.timeoutMs,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AGE createJob failed: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as { job_id: string; status: string };
  return { job_id: data.job_id };
}

/**
 * Get job status and events from AGE.
 */
export async function ageGetJob(
  cfg: AgeClientConfig,
  job_id: string
): Promise<AgeJobStatus> {
  const url = `${cfg.baseUrl}/v1/jobs/${job_id}`;

  const response = await fetchWithProxy(url, {
    method: 'GET',
    timeout: cfg.timeoutMs,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AGE getJob failed: ${response.status} - ${text}`);
  }

  return (await response.json()) as AgeJobStatus;
}

/**
 * Get job result from AGE.
 */
export async function ageGetJobResult(
  cfg: AgeClientConfig,
  job_id: string
): Promise<AgeJobResult> {
  const url = `${cfg.baseUrl}/v1/jobs/${job_id}/result`;

  const response = await fetchWithProxy(url, {
    method: 'GET',
    timeout: cfg.timeoutMs,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AGE getJobResult failed: ${response.status} - ${text}`);
  }

  return (await response.json()) as AgeJobResult;
}

/**
 * Check AGE health.
 */
export async function ageHealthCheck(
  cfg: AgeClientConfig
): Promise<{ status: string; version: string }> {
  const url = `${cfg.baseUrl}/health`;

  const response = await fetchWithProxy(url, {
    method: 'GET',
    timeout: cfg.timeoutMs,
  });

  if (!response.ok) {
    throw new Error(`AGE health check failed: ${response.status}`);
  }

  return (await response.json()) as { status: string; version: string };
}
