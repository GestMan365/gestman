import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.staging.local");

export function loadOfficialStagingEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error("Missing ignored .env.staging.local configuration.");
  }

  const values = {};
  for (const rawLine of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    values[line.slice(0, separator)] = line.slice(separator + 1);
  }

  const required = [
    "OFFICIAL_STAGING_URL",
    "OFFICIAL_STAGING_PUBLISHABLE_KEY",
    "OFFICIAL_STAGING_SERVICE_ROLE_KEY",
    "QA_E2E_PASSWORD",
  ];
  for (const key of required) {
    if (!values[key]) throw new Error(`Missing ${key} in ignored staging configuration.`);
  }

  const url = new URL(values.OFFICIAL_STAGING_URL);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
    throw new Error("Invalid staging URL.");
  }
  if (!values.OFFICIAL_STAGING_PUBLISHABLE_KEY.startsWith("sb_publishable_")) {
    throw new Error("The browser key must be publishable.");
  }
  if (values.OFFICIAL_STAGING_SERVICE_ROLE_KEY.length < 100) {
    throw new Error("Invalid server-only staging key.");
  }
  if (values.QA_E2E_PASSWORD.length < 12) {
    throw new Error("QA password is too short.");
  }

  return Object.freeze({
    root: ROOT,
    url: url.origin,
    publishableKey: values.OFFICIAL_STAGING_PUBLISHABLE_KEY,
    serviceRoleKey: values.OFFICIAL_STAGING_SERVICE_ROLE_KEY,
    qaPassword: values.QA_E2E_PASSWORD,
  });
}
