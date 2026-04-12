// Shared constants for encounter-related components

export const ACTIVITY_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'shot',                     label: 'Shot / Injection',          icon: '💊' },
  { value: 'shot_maintenance',         label: 'Maintenance Shot',          icon: '💉' },
  { value: 'allergy_test',             label: 'Allergy Test (Prick)',       icon: '🧪' },
  { value: 'allergy_test_intradermal', label: 'Allergy Test (Intradermal)', icon: '🔬' },
  { value: 'consent_signed',           label: 'Consent Signed',            icon: '📋' },
  { value: 'video_education',          label: 'Video Watched',             icon: '🎬' },
  { value: 'phone_call',               label: 'Phone Call',                icon: '📞' },
  { value: 'telehealth',               label: 'Telehealth Visit',          icon: '💻' },
  { value: 'email',                    label: 'Email',                     icon: '📧' },
  { value: 'in_person_visit',          label: 'In-Person Visit',           icon: '🏥' },
  { value: 'appointment_scheduled',    label: 'Appointment Scheduled',     icon: '📅' },
  { value: 'no_show',                  label: 'No Show',                   icon: '❌' },
  { value: 'note',                     label: 'Note',                      icon: '📝' },
  { value: 'lab_order',                label: 'Lab Order',                 icon: '🔬' },
  { value: 'referral',                 label: 'Referral',                  icon: '🔗' },
  { value: 'prescription',             label: 'Prescription',              icon: '📃' },
  { value: 'kiosk_checkin',            label: 'Kiosk Check-in',            icon: '🖥️' },
];

export const ACTIVITY_ICON: Record<string, string> = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.value, t.icon]));
export const ACTIVITY_LABEL: Record<string, string> = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.value, t.label]));
export const SOAP_TYPES = new Set(['in_person_visit', 'telehealth', 'phone_call']);

export const ENC_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  open:        { bg: '#fef9c3', color: '#b45309', label: 'Open' },
  complete:    { bg: '#dcfce7', color: '#15803d', label: 'Complete' },
  awaiting_md: { bg: '#eff6ff', color: '#1d4ed8', label: 'Awaiting MD' },
  signed:      { bg: '#f5f3ff', color: '#7c3aed', label: 'Signed' },
  billed:      { bg: '#ecfdf5', color: '#065f46', label: 'Billed' },
  cancelled:   { bg: '#f3f4f6', color: '#64748b', label: 'Cancelled' },
};
