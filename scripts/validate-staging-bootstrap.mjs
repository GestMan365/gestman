const baseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const anonKey = String(process.env.SUPABASE_ANON_KEY || "");
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const qaPassword = String(process.env.QA_SECURITY_PASSWORD || "");

if (!baseUrl || !anonKey || !serviceKey || qaPassword.length < 12) {
  throw new Error("Staging validation environment is incomplete.");
}

const qaEmail = "qa-security-bootstrap@example.invalid";
const qaSlug = "qa-security-bootstrap";
let passed = 0;
let failed = 0;

function check(label, condition) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL - ${label}`);
    return;
  }
  passed += 1;
  console.log(`OK - ${label}`);
}

async function api(path, {
  method = "GET",
  key = serviceKey,
  token = key,
  body,
  headers = {},
} = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined
      ? undefined
      : typeof body === "string"
      ? body
      : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: response.status, payload };
}

async function cleanup() {
  await api(`/rest/v1/gm_companies?slug=eq.${encodeURIComponent(qaSlug)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  const listed = await api("/auth/v1/admin/users?per_page=1000");
  const users = Array.isArray(listed.payload?.users) ? listed.payload.users : [];
  for (const user of users) {
    if (String(user.email || "").toLowerCase() === qaEmail) {
      await api(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
    }
  }
}

async function main() {
  await cleanup();

  const created = await api("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email: qaEmail,
      password: qaPassword,
      email_confirm: true,
      user_metadata: { qa_marker: "QA-SECURITY" },
    },
  });
  check("QA Auth user created", created.status === 200 || created.status === 201);

  const signedIn = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    key: anonKey,
    token: anonKey,
    body: { email: qaEmail, password: qaPassword },
  });
  const accessToken = String(signedIn.payload?.access_token || "");
  check("QA Auth session created", signedIn.status === 200 && accessToken.length > 40);

  const unauthenticated = await api("/functions/v1/bootstrap-company", {
    method: "POST",
    key: anonKey,
    token: anonKey,
    headers: { "x-idempotency-key": "qa-security-precheck-unauth-0001" },
    body: {
      name: "QA-SECURITY-COMPANY-A",
      slug: qaSlug,
      display_name: "QA Security Administrator",
    },
  });
  check("anonymous bootstrap blocked", unauthenticated.status === 401);

  const administrativeField = await api("/functions/v1/bootstrap-company", {
    method: "POST",
    key: anonKey,
    token: accessToken,
    headers: { "x-idempotency-key": "qa-security-precheck-field-0001" },
    body: {
      name: "QA-SECURITY-COMPANY-A",
      slug: qaSlug,
      display_name: "QA Security Administrator",
      company_id: "forbidden",
    },
  });
  check("administrative field rejected", administrativeField.status === 400);

  const oversized = await api("/functions/v1/bootstrap-company", {
    method: "POST",
    key: anonKey,
    token: accessToken,
    headers: { "x-idempotency-key": "qa-security-precheck-large-0001" },
    body: JSON.stringify({
      name: "X".repeat(9000),
      slug: qaSlug,
      display_name: "QA Security Administrator",
    }),
  });
  check("oversized payload rejected", oversized.status === 413);

  const idempotencyKey = "qa-security-precheck-valid-0001";
  const valid = await api("/functions/v1/bootstrap-company", {
    method: "POST",
    key: anonKey,
    token: accessToken,
    headers: { "x-idempotency-key": idempotencyKey },
    body: {
      name: "QA-SECURITY-COMPANY-A",
      slug: qaSlug,
      display_name: "QA Security Administrator",
    },
  });
  check("valid bootstrap accepted", valid.status === 201 && valid.payload?.ok === true);
  check(
    "bootstrap response has no internal identifiers",
    valid.payload
      && !("company_id" in valid.payload)
      && !("user_id" in valid.payload)
      && !("role" in valid.payload)
      && !("token" in valid.payload),
  );

  const repeated = await api("/functions/v1/bootstrap-company", {
    method: "POST",
    key: anonKey,
    token: accessToken,
    headers: { "x-idempotency-key": idempotencyKey },
    body: {
      name: "QA-SECURITY-COMPANY-A",
      slug: qaSlug,
      display_name: "QA Security Administrator",
    },
  });
  check("repeated bootstrap is idempotent", repeated.status === 200);

  const companies = await api(
    `/rest/v1/gm_companies?select=id&slug=eq.${encodeURIComponent(qaSlug)}`,
  );
  check(
    "bootstrap created exactly one company",
    companies.status === 200
      && Array.isArray(companies.payload)
      && companies.payload.length === 1,
  );

  const companyId = companies.payload?.[0]?.id;
  const members = companyId
    ? await api(
      `/rest/v1/gm_company_members?select=user_id&company_id=eq.${encodeURIComponent(companyId)}`,
    )
    : { status: 0, payload: [] };
  check(
    "bootstrap created exactly one membership",
    members.status === 200
      && Array.isArray(members.payload)
      && members.payload.length === 1,
  );
}

try {
  await main();
} finally {
  await cleanup();
}

console.log(`RESULT bootstrap-staging passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
