/**
 * T1 External Agent Adapter
 *
 * PLACEHOLDER - Not yet implemented
 *
 * This adapter will enable non-LiYe OS agents to consume T1 reasoning primitives.
 */

// =============================================================================
// Types (Placeholder)
// =============================================================================

export interface ExternalCredentials {
  agent_id: string;
  api_key: string;
  permissions: string[];
}

export interface Session {
  session_id: string;
  agent_id: string;
  expires_at: Date;
  rate_limit: RateLimit;
}

export interface RateLimit {
  requests_per_minute: number;
  tokens_per_minute: number;
  current_usage: {
    requests: number;
    tokens: number;
  };
}

// =============================================================================
// Adapter (Placeholder Implementation)
// =============================================================================

export class ExternalAgentAdapter {
  private kernelVersion = '1.0.0';

  /**
   * Authenticate external agent
   * @throws NotImplementedError
   */
  async authenticate(_credentials: ExternalCredentials): Promise<Session> {
    throw new Error('ExternalAgentAdapter not yet implemented');
  }

  /**
   * Invoke T1 kernel method
   * @throws NotImplementedError
   */
  async invoke(
    _session: Session,
    _method: string,
    _params: Record<string, unknown>
  ): Promise<unknown> {
    throw new Error('ExternalAgentAdapter not yet implemented');
  }

  /**
   * Get kernel metadata
   */
  getKernelMeta() {
    return {
      name: 'T1_REASONING_KERNEL',
      version: this.kernelVersion,
      stability: 'v1_stable',
      adapter_status: 'PLACEHOLDER'
    };
  }
}

// =============================================================================
// Export
// =============================================================================

export default ExternalAgentAdapter;
