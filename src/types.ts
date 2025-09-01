export type InfusionStatus = "active" | "completed" | "canceled";

export type Infusion = {
  id: string;
  user_id: string;
  patient_name: string;
  room: string | null;
  bed: string | null;
  volume_ml: number;
  drops_per_ml: number;
  rate_dpm: number;
  start_at: string;   // ISO
  end_at: string;     // ISO
  notify_email: boolean;
  status: InfusionStatus;
  completed_at: string | null;
  canceled_at: string | null;
  created_at: string;
};
