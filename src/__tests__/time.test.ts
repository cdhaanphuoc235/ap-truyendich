import { calcMinutes, computeEndAtFromNow, secondsUntil } from "../lib/time";

describe("time utils", () => {
  it("calcMinutes computes infusion minutes correctly", () => {
    expect(calcMinutes(500, 20, 25)).toBe(400); // 500*20/25
    expect(calcMinutes(100, 20, 60)).toBeCloseTo(33.3333, 4);
  });

  it("computeEndAtFromNow returns future ISO string", () => {
    const start = Date.now();
    const endIso = computeEndAtFromNow(1.5);
    const end = new Date(endIso).getTime();
    expect(end).toBeGreaterThan(start + 80 * 1000); // >80s buffer
  });

  it("secondsUntil clamps to 0 when past", () => {
    const past = new Date(Date.now() - 10_000).toISOString();
    expect(secondsUntil(past)).toBe(0);
  });
});
