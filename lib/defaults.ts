/**
 * @file lib/defaults.ts — App-wide fallback defaults
 * @description Central place for default values that reference real data.
 *   Set DEFAULT_LOCATION_ID env var in Vercel to override the fallback.
 */

/** Fallback location ID when user has no defaultLocationId set */
export const DEFAULT_LOCATION_ID = process.env.DEFAULT_LOCATION_ID ?? 'loc-iat-001'
