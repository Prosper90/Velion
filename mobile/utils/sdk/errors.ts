export class VeilonError extends Error {
  public code?: string;
  public details?: any;

  constructor(message: string, code?: string, details?: any) {
    super(message);
    this.name = 'VeilonError';
    this.code = code;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VeilonError);
    }
  }
}

export class ProofError extends VeilonError {
  constructor(message: string, details?: any) {
    super(message, 'PROOF_ERROR', details);
    this.name = 'ProofError';
  }
}

export class ContractError extends VeilonError {
  constructor(message: string, details?: any) {
    super(message, 'CONTRACT_ERROR', details);
    this.name = 'ContractError';
  }
}

export class RelayerError extends VeilonError {
  constructor(message: string, details?: any) {
    super(message, 'RELAYER_ERROR', details);
    this.name = 'RelayerError';
  }
}

export class NetworkError extends VeilonError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends VeilonError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends VeilonError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

export class ComplianceError extends VeilonError {
  constructor(message: string, details?: any) {
    super(message, 'COMPLIANCE_ERROR', details);
    this.name = 'ComplianceError';
  }
}

export class EmergencyError extends VeilonError {
  constructor(message: string, details?: any) {
    super(message, 'EMERGENCY_ERROR', details);
    this.name = 'EmergencyError';
  }
}