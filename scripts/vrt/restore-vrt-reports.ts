import { VRT_RETENTION_DAYS } from "./report.ts";
import { restoreVrtReports } from "./pages.ts";

const distDir = process.env.VRT_DIST ?? "dist";
const baseUrl = process.env.VRT_PAGES_BASE_URL ?? "";
const retentionDays = Number(
  process.env.VRT_RETENTION_DAYS ?? String(VRT_RETENTION_DAYS),
);

const manifest = await restoreVrtReports({
  distDir,
  baseUrl,
  retentionDays: Number.isInteger(retentionDays)
    ? retentionDays
    : VRT_RETENTION_DAYS,
});
process.stdout.write(
  `既存の VRT レポートを ${String(manifest.reports.length)} 件残しました\n`,
);
