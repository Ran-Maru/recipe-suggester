import { describe, expect, it } from "vite-plus/test";
import { shouldRunBiweeklyAudit } from "./biweekly-gate.ts";

function jst(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

describe("shouldRunBiweeklyAudit", () => {
  it("起点の金曜は実行する", () => {
    expect(shouldRunBiweeklyAudit("schedule", jst(2026, 10, 2))).toBe(true);
  });

  it("起点の翌日（土曜へのずれ）は実行する", () => {
    expect(shouldRunBiweeklyAudit("schedule", jst(2026, 10, 3))).toBe(true);
  });

  it("13日後は実行しない", () => {
    expect(shouldRunBiweeklyAudit("schedule", jst(2026, 10, 15))).toBe(false);
  });

  it("14日後は実行する", () => {
    expect(shouldRunBiweeklyAudit("schedule", jst(2026, 10, 16))).toBe(true);
  });

  it("起点より前は実行しない", () => {
    expect(shouldRunBiweeklyAudit("schedule", jst(2026, 10, 1))).toBe(false);
  });

  it("手動実行は日付に関係なく実行する", () => {
    expect(shouldRunBiweeklyAudit("workflow_dispatch", jst(2026, 10, 15))).toBe(
      true,
    );
  });

  it("日本時間の日付で判定する", () => {
    expect(
      shouldRunBiweeklyAudit("schedule", new Date("2026-10-01T15:30:00.000Z")),
    ).toBe(true);
    expect(
      shouldRunBiweeklyAudit("schedule", new Date("2026-10-01T14:30:00.000Z")),
    ).toBe(false);
  });
});
