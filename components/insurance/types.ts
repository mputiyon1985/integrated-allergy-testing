export interface BillingRule {
  id: string;
  name: string;
  description?: string;
  insuranceType: string;
  ruleType: string;
  cptCode?: string;
  relatedCptCode?: string;
  maxUnits?: number;
  requiresModifier?: string;
  requiresDxMatch: boolean;
  warningMessage: string;
  severity: 'warning' | 'hard_block' | 'info';
  overrideRequiresAdmin: boolean;
  active: boolean;
  sortOrder: number;
}

export interface InsuranceCompany {
  id: string;
  name: string;
  type: string;
  payerId?: string;
  phone?: string;
  fax?: string;
  website?: string;
  planTypes?: string;
  notes?: string;
  active: boolean;
  sortOrder: number;
}

export const INSURANCE_COLORS: Record<string, { bg: string; color: string }> = {
  medicare:   { bg: '#dbeafe', color: '#1d4ed8' },
  medicaid:   { bg: '#dcfce7', color: '#15803d' },
  all:        { bg: '#f1f5f9', color: '#475569' },
  bcbs:       { bg: '#ede9fe', color: '#6d28d9' },
  commercial: { bg: '#fce7f3', color: '#be185d' },
  tricare:    { bg: '#fed7aa', color: '#c2410c' },
  aetna:      { bg: '#fef9c3', color: '#a16207' },
  united:     { bg: '#e0f2fe', color: '#0369a1' },
  cigna:      { bg: '#f0fdf4', color: '#166534' },
};

export const SEVERITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  info:       { bg: '#f0f9ff', color: '#0369a1', label: 'Info' },
  warning:    { bg: '#fef9c3', color: '#a16207', label: 'Warning' },
  hard_block: { bg: '#fee2e2', color: '#b91c1c', label: 'Hard Block' },
};

export const RULE_TYPE_ICONS: Record<string, string> = {
  same_day_conflict:  '⚡',
  requires_modifier:  '🔖',
  max_units:          '🔢',
  lifetime_limit:     '♾️',
  dx_required:        '🏥',
  prior_auth:         '📋',
  specialist_required:'👨‍⚕️',
  supervision:        '👁️',
  documentation:      '📝',
  unbundling:         '⚠️',
  in_person_required: '🏢',
};

export const RULE_TYPES = Object.keys(RULE_TYPE_ICONS);

export const INSURANCE_FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'medicare', label: 'Medicare' },
  { key: 'medicaid', label: 'Medicaid' },
  { key: 'bcbs', label: 'BCBS' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'tricare', label: 'Tricare' },
  { key: 'aetna', label: 'Aetna' },
  { key: 'united', label: 'United' },
  { key: 'cigna', label: 'Cigna' },
  { key: 'all', label: 'All Payers' },
];

export const SEVERITY_FILTER_TABS = [
  { key: '', label: 'All Severity' },
  { key: 'hard_block', label: '🚫 Hard Blocks' },
  { key: 'warning', label: '⚠️ Warnings' },
  { key: 'info', label: 'ℹ️ Info' },
];

export const EMPTY_RULE: Partial<BillingRule> = {
  name: '', description: '', insuranceType: 'all', ruleType: 'same_day_conflict',
  cptCode: '', relatedCptCode: '', requiresModifier: '',
  requiresDxMatch: false, warningMessage: '',
  severity: 'warning', overrideRequiresAdmin: false, active: true,
};

export const EMPTY_COMPANY: Partial<InsuranceCompany> = {
  name: '', type: 'commercial', payerId: '', phone: '', fax: '',
  website: '', planTypes: '', notes: '', active: true, sortOrder: 0,
};
