// packages/vcb-core/src/errors.ts
// VCB 도메인 에러 계층

export class VcbError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'VcbError';
  }
}

export class LicenseGateError extends VcbError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'LICENSE_GATE', context);
    this.name = 'LicenseGateError';
  }
}

export class ValidationError extends VcbError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION', context);
    this.name = 'ValidationError';
  }
}

export class IngestError extends VcbError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INGEST', context);
    this.name = 'IngestError';
  }
}

export class SupabaseClientError extends VcbError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SUPABASE_CLIENT', context);
    this.name = 'SupabaseClientError';
  }
}

export class EnvironmentError extends VcbError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'ENVIRONMENT', context);
    this.name = 'EnvironmentError';
  }
}
