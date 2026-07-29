import { cleanupQa, cleanupSummary } from "./support/staging-api.mjs";

export default async function globalTeardown() {
  await cleanupQa();
  const remaining = await cleanupSummary();
  if (Object.values(remaining).some((value) => value !== 0)) {
    throw new Error(`QA cleanup incomplete: ${JSON.stringify(remaining)}`);
  }
  console.log("QA-DESIGN-FINAL cleanup verified: zero records remain.");
}
