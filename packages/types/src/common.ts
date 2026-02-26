// Common/shared types used across domains
export type UUID = string & { readonly _brand: 'UUID' };

export interface AnalysisMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
}

export interface AvailabilitySlotDTO {
  weekday: number;
  startMinute: number;
  endMinute: number;
  timezone?: string;
}
