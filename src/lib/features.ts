import type { CompanyFeature } from '@/types/database'

/**
 * Returns true if a company has a given feature active.
 * If features array is empty (no rows in DB = legacy company), all features are enabled.
 */
export function hasFeature(features: string[], feature: CompanyFeature): boolean {
  if (features.length === 0) return true
  return features.includes(feature)
}
