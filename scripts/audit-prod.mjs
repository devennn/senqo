#!/usr/bin/env node
/**
 * Production dependency audit gate.
 *
 * Runs `npm audit --omit=dev` for each package (dev tooling is out of scope) and
 * fails on high/critical advisories that are not in the documented allowlist
 * below. Requires registry access — CI runs it in the hygiene job.
 *
 * Usage: node scripts/audit-prod.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["backend", "frontend", "whatsapp"];

/**
 * Advisories accepted for now. Keep each entry with a reason; remove once a fix
 * ships (the weekly Dependabot feed is the reminder).
 */
const ALLOWLIST = new Map([
  [
    "GHSA-4r6h-8v6p-xvw6",
    "xlsx prototype pollution — no fixed release on the npm registry (SheetJS distributes elsewhere)",
  ],
  [
    "GHSA-5pgg-2g8v-p4x9",
    "xlsx ReDoS — no fixed release on the npm registry",
  ],
]);

/** Runs the audit and returns the parsed report even when npm exits non-zero. */
function auditReport(packageDir) {
  const args = ["audit", "--omit=dev", "--json", "--package-lock-only"];
  let raw = "";
  try {
    raw = execFileSync("npm", args, {
      cwd: packageDir,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    raw = typeof error.stdout === "string" ? error.stdout : error.stdout?.toString() ?? "";
    if (!raw) throw error;
  }
  return JSON.parse(raw);
}

let failed = false;

for (const pkg of PACKAGES) {
  const dir = path.join(ROOT, pkg);
  const report = auditReport(dir);
  const counts = report.metadata?.vulnerabilities ?? {};

  for (const [name, info] of Object.entries(report.vulnerabilities ?? {})) {
    if (info.severity !== "high" && info.severity !== "critical") continue;

    const advisoryIds = (Array.isArray(info.via) ? info.via : [])
      .filter((via) => typeof via === "object" && via.url)
      .map((via) => via.url.split("/").pop());

    const unallowed = advisoryIds.filter((id) => !ALLOWLIST.has(id));
    if (advisoryIds.length > 0 && unallowed.length === 0) {
      console.log(
        `[audit-prod] ${pkg}: allowed ${info.severity} ${name} (${advisoryIds.join(", ")})`,
      );
      continue;
    }

    console.error(
      `[audit-prod] ${pkg}: ${info.severity} ${name} — ${unallowed.join(", ") || "no advisory id; not allowlisted"}`,
    );
    failed = true;
  }

  console.log(
    `[audit-prod] ${pkg}: high=${counts.high ?? 0} critical=${counts.critical ?? 0} moderate=${counts.moderate ?? 0} low=${counts.low ?? 0}`,
  );
}

if (failed) {
  console.error(
    "[audit-prod] Failing: fix the advisories above or add a justified allowlist entry in scripts/audit-prod.mjs.",
  );
  process.exit(1);
}
console.log("[audit-prod] OK: no unallowlisted high/critical advisories in production dependencies.");
