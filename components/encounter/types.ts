// Shared types for encounter-related components

export interface EncounterActivity {
  id: string;
  activityType: string;
  performedBy?: string;
  notes?: string;
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  performedAt?: string;
  createdAt?: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  encounterDate: string;
  status: string;
  chiefComplaint: string;
  doctorId?: string;
  doctorName?: string;
  nurseId?: string;
  nurseName?: string;
  subjectiveNotes?: string;
  objectiveNotes?: string;
  assessment?: string;
  plan?: string;
  diagnosisCode?: string;
  followUpDays?: number;
  cptSummary?: string;
  signedBy?: string;
  signedAt?: string;
  billedAt?: string;
  waitMinutes?: number;
  inServiceMinutes?: number;
  activities?: EncounterActivity[];
}

export interface DoctorOption { id: string; name: string; title?: string; }
export interface NurseOption  { id: string; name: string; title?: string; }
export interface Icd10Option  { id: string; code: string; description: string; }
