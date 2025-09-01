import React, { useState } from "react";
import Input from "./ui/Input";
import Checkbox from "./ui/Checkbox";
import Button from "./ui/Button";
import { Info } from "lucide-react";
import { calcMinutes, computeEndAtFromNow } from "../lib/time";
import { createInfusion } from "../lib/db";

export type InfusionFormValues = {
  patient_name: string;
  room: string;
  bed: string;
  volume_ml: number | "";
  drops_per_ml: number | "";
  rate_dpm: number | "";
  notify_email: boolean;
};

const initialValues: InfusionFormValues = {
  patient_name: "",
  room: "",
  bed: "",
  volume_ml: "",
  drops_per_ml: "",
  rate_dpm: "",
  notify_email: false,
};

export default function InfusionForm() {
  const [v, setV] = useState<InfusionFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);

  const onChange =
    (key: keyof InfusionFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const isCheckbox = e.target.type === "checkbox";
      const raw = isCheckbox ? (e.target as HTMLInputElement).checked : e.target.value;
      setV((s) => ({
        ...s,
        [key]: e.target.type === "number" && raw !== "" ? Number(raw) : (raw as any),
      }));
    };

  const reset = () => setV(initialValues);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const okNums =
      v.volume_ml !== "" && v.volume_ml > 0 &&
      v.drops_per_ml !== "" && v.drops_per_ml > 0 &&
      v.rate_dpm !== "" && v.rate_dpm > 0;

    if (!v.patient_name || !okNums) {
      alert("Vui lòng nhập đủ thông tin và các số phải > 0.");
      return;
    }

    try {
      setSubmitting(true);
      const minutes = calcMinutes(
        Number(v.volume_ml),
        Number(v.drops_per_ml),
        Number(v.rate_dpm)
      );
      const end_at = computeEndAtFromNow(minutes);

      await createInfusion({
        patient_name: v.patient_name.trim(),
        room: v.room.trim() || undefined,
        bed: v.bed.trim() || undefined,
        volume_ml: Number(v.volume_ml),
        drops_per_ml: Number(v.drops_per_ml),
        rate_dpm: Number(v.rate_dpm),
        end_at,
        notify_email: Boolean(v.notify_email),
      });

      reset();
      // Realtime sẽ tự đồng bộ danh sách Active
    } catch (err: any) {
      alert(`Không thể tạo ca: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <Input
          label="Họ và tên"
          placeholder="VD: Nguyễn Thị A"
          value={v.patient_name}
          onChange={onChange("patient_name")}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phòng" placeholder="VD: 301" value={v.room} onChange={onChange("room")} />
          <Input label="Giường" placeholder="VD: 12" value={v.bed} onChange={onChange("bed")} />
        </div>

        <Input
          type="number"
          inputMode="numeric"
          label="Thể tích dịch truyền (ml)"
          placeholder="VD: 500"
          value={v.volume_ml as number | ""}
          onChange={onChange("volume_ml")}
          min={1}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            inputMode="numeric"
            label="Số giọt/ml"
            placeholder="VD: 20"
            value={v.drops_per_ml as number | ""}
            onChange={onChange("drops_per_ml")}
            min={1}
            required
          />
          <Input
            type="number"
            inputMode="numeric"
            label="Tốc độ (giọt/phút)"
            placeholder="VD: 30"
            value={v.rate_dpm as number | ""}
            onChange={onChange("rate_dpm")}
            min={1}
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <Checkbox
            label="Nhận thông báo qua email"
            checked={v.notify_email}
            onChange={onChange("notify_email")}
          />
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4" />
            <span>Email gửi khi ca kết thúc (cron server — GĐ6).</span>
          </div>
        </div>
      </div>

      <Button type="submit" variant="primary" full className="text-lg" disabled={submitting}>
        {submitting ? "Đang tạo ca…" : "Bắt đầu truyền"}
      </Button>
    </form>
  );
}
