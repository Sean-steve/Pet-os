/**
 * Pet OS Shared Kernel - Standardized Error Contracts & Envelopes
 * Implements Volume XXVIII - API & Integration Specification.
 * Every failure returns a stable machine code, safe human message, and correlation ID.
 */

export type ErrorCode =
  | 'AUTH_001' // UNAUTHENTICATED (401)
  | 'AUTH_002' // FORBIDDEN (403)
  | 'AUTH_003' // MEMBERSHIP_EXPIRED (403)
  | 'AUTH_004' // INVALID_CREDENTIALS (401)
  | 'AUTH_005' // ACCOUNT_SUSPENDED (403)
  | 'AUTH_006' // ACCOUNT_UNVERIFIED (403)
  | 'AUTH_007' // TOKEN_EXPIRED (410)
  | 'AUTH_008' // DUPLICATE_IDENTITY (409)
  | 'AUTH_009' // FINAL_OWNER_PROTECTION (422)
  | 'AUTH_010' // INVITATION_INVALID (422)
  | 'VALIDATION_001' // INVALID_PAYLOAD (422)
  | 'PET_001'  // PET_NOT_FOUND (404)
  | 'PET_002'  // PET_TRANSFER_REQUIRED (409)
  | 'HEALTH_001' // CLINICAL_PROVENANCE_REQUIRED (422)
  | 'BOOK_001' // SLOT_UNAVAILABLE (409)
  | 'BOOK_002' // INVALID_TRANSITION (409)
  | 'WALK_001' // START_WINDOW_VIOLATION (409)
  | 'WALK_002' // ACTIVE_SESSION_EXISTS (409)
  | 'PAY_001'  // IDEMPOTENCY_CONFLICT (409)
  | 'PAY_002'  // AMOUNT_MISMATCH (422)
  | 'PAY_003'  // REFUND_EXCEEDS_CAPTURE (422)
  | 'COM_001'  // OUT_OF_STOCK (409)
  | 'COM_002'  // SELLER_NOT_VERIFIED (403)
  | 'LOC_001'  // LOCATION_PERMISSION_REQUIRED (403)
  | 'LOC_002'  // STALE_LOCATION (409)
  | 'LOC_003'  // INVALID_GEOFENCE (422)
  | 'LOST_001' // INCIDENT_ALREADY_ACTIVE (409)
  | 'LOST_002' // PUBLIC_TOKEN_REVOKED (410)
  | 'AI_001'   // HIGH_RISK_ESCALATION (422)
  | 'AI_002'   // INSUFFICIENT_CONTEXT (422)
  | 'RATE_001' // RATE_LIMITED (429)
  | 'FILE_001' // UNSAFE_UPLOAD (422)
  | 'SYS_001'; // VERSION_CONFLICT (409)

export interface ErrorDefinition {
  code: ErrorCode;
  name: string;
  httpStatus: number;
  defaultMessage: string;
}

export const ERROR_REGISTRY: Record<ErrorCode, ErrorDefinition> = {
  AUTH_001: {
    code: 'AUTH_001',
    name: 'UNAUTHENTICATED',
    httpStatus: 401,
    defaultMessage: 'Authentication missing, expired, or invalid.'
  },
  AUTH_002: {
    code: 'AUTH_002',
    name: 'FORBIDDEN',
    httpStatus: 403,
    defaultMessage: 'Actor lacks required permission or purpose-bound grant.'
  },
  AUTH_003: {
    code: 'AUTH_003',
    name: 'MEMBERSHIP_EXPIRED',
    httpStatus: 403,
    defaultMessage: 'Household or temporary membership is inactive or expired.'
  },
  AUTH_004: {
    code: 'AUTH_004',
    name: 'INVALID_CREDENTIALS',
    httpStatus: 401,
    defaultMessage: 'Invalid credentials provided. Authentication failed.'
  },
  AUTH_005: {
    code: 'AUTH_005',
    name: 'ACCOUNT_SUSPENDED',
    httpStatus: 403,
    defaultMessage: 'Account is suspended or deactivated. Access is denied.'
  },
  AUTH_006: {
    code: 'AUTH_006',
    name: 'ACCOUNT_UNVERIFIED',
    httpStatus: 403,
    defaultMessage: 'Account email or identity is pending verification.'
  },
  AUTH_007: {
    code: 'AUTH_007',
    name: 'TOKEN_EXPIRED',
    httpStatus: 410,
    defaultMessage: 'Verification or reset token has expired or already been consumed.'
  },
  AUTH_008: {
    code: 'AUTH_008',
    name: 'DUPLICATE_IDENTITY',
    httpStatus: 409,
    defaultMessage: 'An account with this email or identity already exists.'
  },
  AUTH_009: {
    code: 'AUTH_009',
    name: 'FINAL_OWNER_PROTECTION',
    httpStatus: 422,
    defaultMessage: 'Cannot remove or demote the sole active owner of a household without ownership transfer.'
  },
  AUTH_010: {
    code: 'AUTH_010',
    name: 'INVITATION_INVALID',
    httpStatus: 422,
    defaultMessage: 'Invitation is expired, revoked, or already accepted.'
  },
  VALIDATION_001: {
    code: 'VALIDATION_001',
    name: 'INVALID_PAYLOAD',
    httpStatus: 422,
    defaultMessage: 'The provided request payload failed schema validation.'
  },
  PET_001: {
    code: 'PET_001',
    name: 'PET_NOT_FOUND',
    httpStatus: 404,
    defaultMessage: 'Pet does not exist or is not visible to the current actor.'
  },
  PET_002: {
    code: 'PET_002',
    name: 'PET_TRANSFER_REQUIRED',
    httpStatus: 409,
    defaultMessage: 'Household ownership change requires formal transfer workflow.'
  },
  HEALTH_001: {
    code: 'HEALTH_001',
    name: 'CLINICAL_PROVENANCE_REQUIRED',
    httpStatus: 422,
    defaultMessage: 'Professional clinical records require verified clinician authoring context.'
  },
  BOOK_001: {
    code: 'BOOK_001',
    name: 'SLOT_UNAVAILABLE',
    httpStatus: 409,
    defaultMessage: 'Requested booking slot or capacity is no longer available.'
  },
  BOOK_002: {
    code: 'BOOK_002',
    name: 'INVALID_TRANSITION',
    httpStatus: 409,
    defaultMessage: 'Requested booking lifecycle state transition is not allowed.'
  },
  WALK_001: {
    code: 'WALK_001',
    name: 'START_WINDOW_VIOLATION',
    httpStatus: 409,
    defaultMessage: 'Walk cannot be started outside authorized time window.'
  },
  WALK_002: {
    code: 'WALK_002',
    name: 'ACTIVE_SESSION_EXISTS',
    httpStatus: 409,
    defaultMessage: 'An active walk session already exists for this booking/pet.'
  },
  PAY_001: {
    code: 'PAY_001',
    name: 'IDEMPOTENCY_CONFLICT',
    httpStatus: 409,
    defaultMessage: 'Idempotency key was reused with different payload parameters.'
  },
  PAY_002: {
    code: 'PAY_002',
    name: 'AMOUNT_MISMATCH',
    httpStatus: 422,
    defaultMessage: 'Payment provider callback amount or currency does not match intent.'
  },
  PAY_003: {
    code: 'PAY_003',
    name: 'REFUND_EXCEEDS_CAPTURE',
    httpStatus: 422,
    defaultMessage: 'Requested refund exceeds settled refundable captured amount.'
  },
  COM_001: {
    code: 'COM_001',
    name: 'OUT_OF_STOCK',
    httpStatus: 409,
    defaultMessage: 'Requested item quantity cannot be reserved in inventory.'
  },
  COM_002: {
    code: 'COM_002',
    name: 'SELLER_NOT_VERIFIED',
    httpStatus: 403,
    defaultMessage: 'Merchant is unverified and cannot publish or sell inventory.'
  },
  LOC_001: {
    code: 'LOC_001',
    name: 'LOCATION_PERMISSION_REQUIRED',
    httpStatus: 403,
    defaultMessage: 'Exact location access is RESTRICTED and permission is absent.'
  },
  LOC_002: {
    code: 'LOC_002',
    name: 'STALE_LOCATION',
    httpStatus: 409,
    defaultMessage: 'Requested action requires a fresher location telemetry fix.'
  },
  LOC_003: {
    code: 'LOC_003',
    name: 'INVALID_GEOFENCE',
    httpStatus: 422,
    defaultMessage: 'Geofence geometry is invalid or outside permitted bounds.'
  },
  LOST_001: {
    code: 'LOST_001',
    name: 'INCIDENT_ALREADY_ACTIVE',
    httpStatus: 409,
    defaultMessage: 'Pet already has an active lost pet incident in progress.'
  },
  LOST_002: {
    code: 'LOST_002',
    name: 'PUBLIC_TOKEN_REVOKED',
    httpStatus: 410,
    defaultMessage: 'Public lost pet recovery link has expired or was revoked.'
  },
  AI_001: {
    code: 'AI_001',
    name: 'HIGH_RISK_ESCALATION',
    httpStatus: 422,
    defaultMessage: 'AI output restricted due to veterinary emergency / medical escalation risk.'
  },
  AI_002: {
    code: 'AI_002',
    name: 'INSUFFICIENT_CONTEXT',
    httpStatus: 422,
    defaultMessage: 'Trusted pet context is insufficient to generate grounded guidance.'
  },
  RATE_001: {
    code: 'RATE_001',
    name: 'RATE_LIMITED',
    httpStatus: 429,
    defaultMessage: 'Applicable rate limit exceeded. Please retry with backoff.'
  },
  FILE_001: {
    code: 'FILE_001',
    name: 'UNSAFE_UPLOAD',
    httpStatus: 422,
    defaultMessage: 'Uploaded file failed MIME type, extension, or security scan.'
  },
  SYS_001: {
    code: 'SYS_001',
    name: 'VERSION_CONFLICT',
    httpStatus: 409,
    defaultMessage: 'Optimistic concurrency mismatch: resource was updated concurrently.'
  }
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    const def = ERROR_REGISTRY[code];
    super(message || def.defaultMessage);
    this.name = def.name;
    this.code = code;
    this.httpStatus = def.httpStatus;
    this.details = details;
  }

  toResponseEnvelope(correlationId: string) {
    return {
      error: {
        code: this.code,
        name: this.name,
        message: this.message,
        details: this.details || {}
      },
      meta: {
        correlation_id: correlationId
      }
    };
  }
}
