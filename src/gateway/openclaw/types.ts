/**
 * LiYe Gateway Types
 *
 * TypeScript types matching contracts/governance/v1/*.schema.json
 */

export type Phase = 'gate' | 'enforce' | 'route' | 'execute' | 'verdict';

export type Decision = 'ALLOW' | 'BLOCK' | 'DEGRADE' | 'PENDING';

export interface GovToolCallRequestV1 {
  version: 'GOV_TOOL_CALL_REQUEST_V1';
  trace_id: string;
  idempotency_key: string;
  tenant_id: string;
  task: string;
  policy_version: string; // e.g., "phase1-v1.0.0"
  proposed_actions: Array<{
    action_type: 'read';
    tool: 'amazon://strategy/wasted-spend-detect';
    arguments: {
      start_date: string;
      end_date: string;
      min_spend?: number;
      min_clicks?: number;
      max_rows?: number;
    };
  }>;
  context: {
    source: 'openclaw';
    channel: 'slack';
    session_id: string;
    user_id: string;
    message_id: string;
  };
}

export interface StreamChunkV1 {
  version: 'STREAM_CHUNK_V1';
  type: 'chunk' | 'complete' | 'error';
  trace_id: string;
  phase: Phase;
  progress: number; // 0-100
  data?: Record<string, unknown>;
}

export interface GovToolCallResponseV1 {
  version: 'GOV_TOOL_CALL_RESPONSE_V1';
  trace_id: string;
  decision: Decision;
  verdict_summary: string;
  execution_result?: Record<string, unknown>;
  evidence_package?: {
    report_ids?: string[];
    time_range?: {
      start_date: string;
      end_date: string;
    };
    analyzed_at?: string;
  };
  policy_version: string;
  mock_used?: boolean;
}

// JSON-RPC 2.0 types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Trace event type
export interface TraceEvent {
  seq: number;
  ts: number;
  phase: string;
  progress: number;
  kind: 'info' | 'data' | 'error';
  message?: string;
  data?: Record<string, unknown>;
}

// AGE Job types (from PR#3)
export interface AgeJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  events: Array<{
    seq: number;
    ts: string;
    phase: string;
    progress: number;
    message: string;
    data: Record<string, unknown>;
  }>;
  error?: string;
}

export interface AgeJobResult {
  job_id: string;
  status: 'done' | 'failed';
  result?: {
    summary: Record<string, unknown>;
    wasted_spend: Array<Record<string, unknown>>;
    evidence: Record<string, unknown>;
  };
  error?: string;
}
