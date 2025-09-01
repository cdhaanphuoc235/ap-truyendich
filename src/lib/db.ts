import { supabase } from "./supabaseClient";
import type { Infusion, InfusionStatus } from "../types";

const baseSelect =
  "id,user_id,patient_name,room,bed,volume_ml,drops_per_ml,rate_dpm,start_at,end_at,notify_email,status,completed_at,canceled_at,created_at";

export async function createInfusion(payload: {
  patient_name: string;
  room?: string;
  bed?: string;
  volume_ml: number;
  drops_per_ml: number;
  rate_dpm: number;
  end_at: string; // ISO
  notify_email: boolean;
}) {
  const { data, error } = await supabase
    .from("infusions")
    .insert({
      patient_name: payload.patient_name,
      room: payload.room ?? null,
      bed: payload.bed ?? null,
      volume_ml: payload.volume_ml,
      drops_per_ml: payload.drops_per_ml,
      rate_dpm: payload.rate_dpm,
      end_at: payload.end_at,
      notify_email: payload.notify_email,
      status: "active",
      // user_id mặc định = auth.uid() theo default ở DB
    })
    .select(baseSelect)
    .single();

  if (error) throw new Error(error.message);
  return data as Infusion;
}

export async function listActive() {
  const { data, error } = await supabase
    .from("infusions")
    .select(baseSelect)
    .eq("status", "active")
    .order("end_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Infusion[];
}

export async function listHistory() {
  const { data, error } = await supabase
    .from("infusions")
    .select(baseSelect)
    .neq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Infusion[];
}

export async function cancelInfusion(id: string) {
  const { error } = await supabase
    .from("infusions")
    .update({ status: "canceled" as InfusionStatus })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function clearHistory() {
  const { error } = await supabase
    .from("infusions")
    .delete()
    .neq("status", "active"); // RLS đảm bảo chỉ xóa của user hiện tại
  if (error) throw new Error(error.message);
}

/** Đăng ký realtime thay đổi infusions của user hiện tại */
export function subscribeInfusions(userId: string, cb: () => void) {
  const ch = supabase
    .channel(`infusions:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "infusions", filter: `user_id=eq.${userId}` },
      () => cb()
    )
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}
