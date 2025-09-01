import type { Infusion } from "../types";

const KEY_ACTIVE = "aptd_active_v1";
const KEY_HISTORY = "aptd_history_v1";
const KEY_SAVED_AT = "aptd_saved_at_v1";

export function saveLists(active: Infusion[], history: Infusion[]) {
  try {
    localStorage.setItem(KEY_ACTIVE, JSON.stringify(active));
    localStorage.setItem(KEY_HISTORY, JSON.stringify(history));
    localStorage.setItem(KEY_SAVED_AT, new Date().toISOString());
  } catch {}
}

export function loadLists():
  | { active: Infusion[]; history: Infusion[]; savedAt: string | null }
  | null {
  try {
    const a = localStorage.getItem(KEY_ACTIVE);
    const h = localStorage.getItem(KEY_HISTORY);
    const t = localStorage.getItem(KEY_SAVED_AT);
    if (!a || !h) return null;
    return { active: JSON.parse(a), history: JSON.parse(h), savedAt: t };
  } catch {
    return null;
  }
}
