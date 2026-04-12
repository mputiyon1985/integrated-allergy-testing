/**
 * @file lib/api-error.ts — Standardized API error responses
 * Ensures all error responses follow the same shape: { error: string, code?: string }
 */
import { NextResponse } from 'next/server'
import { HIPAA_HEADERS } from './hipaaHeaders'

type ErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'CONFLICT' | 'INTERNAL_ERROR'

export function apiError(message: string, status: number, code?: ErrorCode) {
  return NextResponse.json(
    { error: message, ...(code ? { code } : {}) },
    { status, headers: HIPAA_HEADERS }
  )
}

export const Errors = {
  unauthorized: ()  => apiError('Unauthorized', 401, 'UNAUTHORIZED'),
  forbidden:    ()  => apiError('Forbidden', 403, 'FORBIDDEN'),
  notFound:     (e='Not found') => apiError(e, 404, 'NOT_FOUND'),
  badRequest:   (e: string) => apiError(e, 400, 'BAD_REQUEST'),
  conflict:     (e: string) => apiError(e, 409, 'CONFLICT'),
  internal:     (e='Internal server error') => apiError(e, 500, 'INTERNAL_ERROR'),
}
