import { createHash } from "node:crypto";

const baseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const anonKey = String(process.env.SUPABASE_ANON_KEY || "");
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const qaPassword = String(process.env.QA_SECURITY_PASSWORD || "");

if (!baseUrl || !anonKey || !serviceKey || qaPassword.length < 12) {
  throw new Error("Staging validation environment is incomplete.");
}

const bucket = "gestman-attachments";
const companyASlug = "qa-security-company-a";
const companyBSlug = "qa-security-company-b";
const convertedSlug = "qa-security-converted";
const requestCnpj = "11222333000181";
const emails = {
  adminA: "qa-security-admin-a@example.invalid",
  commonA: "qa-security-common-a@example.invalid",
  userB: "qa-security-user-b@example.invalid",
  inactive: "qa-security-inactive@example.invalid",
  duplicate: "qa-security-duplicate@example.invalid",
};

let passed = 0;
let failed = 0;
const createdUserIds = new Set();
const rateHashes = new Set();
const storagePaths = new Set();

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
  return { status: response.status, payload, headers: response.headers };
}

function authOptions(token, body, headers = {}) {
  return {
    method: "POST",
    key: anonKey,
    token,
    body,
    headers,
  };
}

async function createAuthUser(email) {
  const result = await api("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email,
      password: qaPassword,
      email_confirm: true,
      user_metadata: { qa_marker: "QA-SECURITY" },
    },
  });
  if ((result.status === 200 || result.status === 201) && result.payload?.id) {
    createdUserIds.add(result.payload.id);
    rateHashes.add(
      createHash("sha256").update(`bootstrap-company:${result.payload.id}`).digest("hex"),
    );
    return result.payload;
  }
  return null;
}

async function signIn(email) {
  const result = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    key: anonKey,
    token: anonKey,
    body: { email, password: qaPassword },
  });
  return result.status === 200 ? String(result.payload?.access_token || "") : "";
}

async function serviceRows(table, query = "") {
  return api(`/rest/v1/${table}?${query}`);
}

async function serviceInsert(table, body) {
  return api(`/rest/v1/${table}`, {
    method: "POST",
    body,
    headers: { Prefer: "return=representation" },
  });
}

async function deleteAuthUsersByMarker() {
  const listed = await api("/auth/v1/admin/users?per_page=1000");
  const users = Array.isArray(listed.payload?.users) ? listed.payload.users : [];
  for (const user of users) {
    const email = String(user.email || "").toLowerCase();
    const metadata = user.user_metadata || {};
    if (
      email.startsWith("qa-security-")
      || email.includes("qasecurity")
      || metadata.qa_marker === "QA-SECURITY"
      || String(metadata.company_slug || "").startsWith("qa-security")
    ) {
      await api(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
    }
  }
}

async function cleanup() {
  for (const path of storagePaths) {
    await api(`/storage/v1/object/${bucket}/${path}`, { method: "DELETE" });
  }
  await api(`/rest/v1/company_requests?cnpj=eq.${requestCnpj}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  for (const slug of [companyASlug, companyBSlug, convertedSlug]) {
    await api(`/rest/v1/gm_companies?slug=eq.${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }
  for (const keyHash of rateHashes) {
    await api(
      `/rest/v1/gm_public_rate_limits?key_hash=eq.${encodeURIComponent(keyHash)}`,
      {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      },
    );
  }
  await deleteAuthUsersByMarker();
}

async function bootstrap(token, slug, name, key) {
  return api("/functions/v1/bootstrap-company", authOptions(token, {
    name,
    slug,
    display_name: `${name} Administrator`,
  }, { "x-idempotency-key": key }));
}

async function main() {
  await cleanup();

  const [adminA, commonA, userB, inactive, duplicate] = await Promise.all(
    Object.values(emails).map(createAuthUser),
  );
  check(
    "five fictitious Auth users created",
    [adminA, commonA, userB, inactive, duplicate].every(Boolean),
  );

  const [tokenAdminA, tokenCommonA, tokenB, tokenInactive, tokenDuplicate] =
    await Promise.all(Object.values(emails).map(signIn));
  check(
    "five QA sessions created",
    [tokenAdminA, tokenCommonA, tokenB, tokenInactive, tokenDuplicate]
      .every((token) => token.length > 40),
  );

  const bootstrapA = await bootstrap(
    tokenAdminA,
    companyASlug,
    "QA-SECURITY-COMPANY-A",
    "qa-security-company-a-create-0001",
  );
  check("Company A bootstrap succeeded", bootstrapA.status === 201);
  check(
    "bootstrap response exposes no internal role or UUID",
    bootstrapA.payload?.ok === true
      && !("company_id" in bootstrapA.payload)
      && !("user_id" in bootstrapA.payload)
      && !("role" in bootstrapA.payload)
      && !("token" in bootstrapA.payload),
  );

  const concurrentB = await Promise.all([
    bootstrap(
      tokenB,
      companyBSlug,
      "QA-SECURITY-COMPANY-B",
      "qa-security-company-b-create-0001",
    ),
    bootstrap(
      tokenB,
      companyBSlug,
      "QA-SECURITY-COMPANY-B",
      "qa-security-company-b-create-0001",
    ),
  ]);
  check(
    "concurrent bootstrap is idempotent",
    concurrentB.some((item) => item.status === 201)
      && concurrentB.every((item) => item.status === 200 || item.status === 201),
  );

  const repeatedA = await bootstrap(
    tokenAdminA,
    companyASlug,
    "QA-SECURITY-COMPANY-A",
    "qa-security-company-a-create-0001",
  );
  check("bootstrap retry after uncertain response is safe", repeatedA.status === 200);

  const [companyARows, companyBRows] = await Promise.all([
    serviceRows("gm_companies", `select=id,name,slug&slug=eq.${companyASlug}`),
    serviceRows("gm_companies", `select=id,name,slug&slug=eq.${companyBSlug}`),
  ]);
  const companyAId = companyARows.payload?.[0]?.id;
  const companyBId = companyBRows.payload?.[0]?.id;
  check(
    "one company per tenant exists",
    companyARows.payload?.length === 1 && companyBRows.payload?.length === 1,
  );

  await serviceInsert("gm_profiles", [
    {
      user_id: commonA.id,
      display_name: "QA Security Common A",
      active: true,
      details: { qa_marker: "QA-SECURITY" },
    },
    {
      user_id: inactive.id,
      display_name: "QA Security Inactive",
      active: false,
      details: { qa_marker: "QA-SECURITY" },
    },
  ]);
  await serviceInsert("gm_company_members", [
    {
      company_id: companyAId,
      user_id: commonA.id,
      role: "technician",
      active: true,
      access_profile: "technician",
      permission_levels: {},
    },
    {
      company_id: companyAId,
      user_id: inactive.id,
      role: "technician",
      active: false,
      access_profile: "technician",
      permission_levels: {},
    },
  ]);
  check("QA tenant members prepared", true);

  const anonCompanies = await api("/rest/v1/gm_companies?select=id", {
    key: anonKey,
    token: anonKey,
  });
  check(
    "anon cannot list companies",
    anonCompanies.status >= 400
      || (Array.isArray(anonCompanies.payload) && anonCompanies.payload.length === 0),
  );

  for (const table of [
    "ativos",
    "ordens_servico",
    "pecas",
    "preventivas",
    "gm_company_members",
  ]) {
    const result = await api(`/rest/v1/${table}?select=*&limit=1`, {
      key: anonKey,
      token: anonKey,
    });
    check(
      `anon cannot read ${table}`,
      result.status >= 400
        || (Array.isArray(result.payload) && result.payload.length === 0),
    );
  }

  const anonInsert = await api("/rest/v1/ativos", {
    method: "POST",
    key: anonKey,
    token: anonKey,
    body: { nome: "QA-SECURITY-FORBIDDEN" },
  });
  check("anon cannot insert operational rows", anonInsert.status >= 400);

  const anonAdminRpc = await api("/rest/v1/rpc/gm_manage_company", {
    method: "POST",
    key: anonKey,
    token: anonKey,
    body: {
      p_company_id: companyAId,
      p_action: "reactivate",
      p_payload: {},
    },
  });
  check("anon cannot execute administrative RPC", anonAdminRpc.status >= 400);

  const companyAVisible = await api("/rest/v1/gm_companies?select=id,slug", {
    key: anonKey,
    token: tokenAdminA,
  });
  check(
    "Company A reads only its tenant",
    companyAVisible.status === 200
      && companyAVisible.payload?.length === 1
      && companyAVisible.payload[0].slug === companyASlug,
  );

  const crossTenantRead = await api(
    `/rest/v1/gm_companies?select=id&slug=eq.${companyBSlug}`,
    { key: anonKey, token: tokenAdminA },
  );
  check(
    "Company A cannot read Company B",
    crossTenantRead.status === 200 && crossTenantRead.payload?.length === 0,
  );

  const crossMemberInsert = await api("/rest/v1/gm_company_members", {
    method: "POST",
    key: anonKey,
    token: tokenAdminA,
    body: {
      company_id: companyBId,
      user_id: commonA.id,
      role: "administrator",
      access_profile: "admin",
    },
  });
  check("Company A cannot insert a Company B membership", crossMemberInsert.status >= 400);

  await api(
    `/rest/v1/gm_company_members?company_id=eq.${companyAId}&user_id=eq.${commonA.id}`,
    {
      method: "PATCH",
      key: anonKey,
      token: tokenAdminA,
      body: { company_id: companyBId },
    },
  );
  const commonMembership = await serviceRows(
    "gm_company_members",
    `select=company_id,access_profile&user_id=eq.${commonA.id}`,
  );
  check(
    "Company A cannot transfer a member to Company B",
    commonMembership.payload?.[0]?.company_id === companyAId,
  );

  await api(`/rest/v1/gm_company_members?user_id=eq.${commonA.id}`, {
    method: "PATCH",
    key: anonKey,
    token: tokenCommonA,
    body: { access_profile: "admin", role: "administrator" },
  });
  const commonProfileAfter = await serviceRows(
    "gm_company_members",
    `select=role,access_profile&user_id=eq.${commonA.id}`,
  );
  check(
    "common user cannot elevate its own access profile",
    commonProfileAfter.payload?.[0]?.access_profile === "technician",
  );

  const globalAdminInsert = await api("/rest/v1/gm_platform_admins", {
    method: "POST",
    key: anonKey,
    token: tokenCommonA,
    body: { user_id: commonA.id, role: "owner", active: true },
  });
  check("tenant user cannot create global administrator", globalAdminInsert.status >= 400);

  const inactiveRead = await api("/rest/v1/gm_companies?select=id", {
    key: anonKey,
    token: tokenInactive,
  });
  check(
    "inactive user cannot read tenant",
    inactiveRead.status === 200 && inactiveRead.payload?.length === 0,
  );

  const inactiveLoad = await api("/rest/v1/rpc/gm_load_tenant_state", {
    method: "POST",
    key: anonKey,
    token: tokenInactive,
    body: {},
  });
  check(
    "inactive user receives no tenant state from RPC",
    inactiveLoad.status >= 400
      || (inactiveLoad.status === 200
        && Array.isArray(inactiveLoad.payload)
        && inactiveLoad.payload.length === 0),
  );

  const loadA = await api("/rest/v1/rpc/gm_load_tenant_state", {
    method: "POST",
    key: anonKey,
    token: tokenAdminA,
    body: {},
  });
  const loadedA = Array.isArray(loadA.payload) ? loadA.payload[0] : loadA.payload;
  check(
    "gm_load_tenant_state resolves Company A",
    loadA.status === 200 && loadedA?.company_id === companyAId,
  );

  const saveA = await api("/rest/v1/rpc/gm_save_tenant_state", {
    method: "POST",
    key: anonKey,
    token: tokenAdminA,
    body: {
      p_expected_version: Number(loadedA?.version || 0),
      p_state: {
        assets: [{ id: "QA-SECURITY-ASSET-001", name: "QA Security Asset" }],
        orders: [{ id: "QA-SECURITY-ORDER-001", description: "QA Security Order" }],
      },
    },
  });
  check(
    "gm_save_tenant_state persists asset and order state",
    saveA.status === 200 && Number(saveA.payload?.[0]?.version) === 1,
  );

  const loadBAfter = await api("/rest/v1/rpc/gm_load_tenant_state", {
    method: "POST",
    key: anonKey,
    token: tokenB,
    body: {},
  });
  const loadedB = Array.isArray(loadBAfter.payload)
    ? loadBAfter.payload[0]
    : loadBAfter.payload;
  check(
    "Company B state is isolated from Company A",
    loadBAfter.status === 200
      && !JSON.stringify(loadedB?.state || {}).includes("QA-SECURITY-ASSET-001"),
  );

  const arbitraryTenant = await api("/rest/v1/rpc/gm_save_tenant_state", {
    method: "POST",
    key: anonKey,
    token: tokenAdminA,
    body: {
      p_expected_version: 1,
      p_state: {},
      company_id: companyBId,
    },
  });
  check("gm_save_tenant_state rejects arbitrary tenant parameter", arbitraryTenant.status >= 400);

  const oldBootstrap = await api("/rest/v1/rpc/gm_bootstrap_company", {
    method: "POST",
    key: anonKey,
    token: tokenAdminA,
    body: {
      p_name: "Forbidden",
      p_slug: "forbidden",
      p_display_name: "Forbidden",
    },
  });
  check("browser cannot execute legacy bootstrap RPC", oldBootstrap.status >= 400);

  const serverBootstrap = await api(
    "/rest/v1/rpc/gm_bootstrap_company_server",
    {
      method: "POST",
      key: anonKey,
      token: tokenAdminA,
      body: {
        p_user_id: adminA.id,
        p_name: "Forbidden",
        p_slug: "forbidden",
        p_display_name: "Forbidden",
        p_idempotency_key: "qa-security-forbidden-0001",
      },
    },
  );
  check("browser cannot execute server bootstrap RPC", serverBootstrap.status >= 400);

  const commonAdminRpc = await api("/rest/v1/rpc/gm_manage_company", {
    method: "POST",
    key: anonKey,
    token: tokenCommonA,
    body: {
      p_company_id: companyAId,
      p_action: "reactivate",
      p_payload: {},
    },
  });
  check("administrative RPC respects tenant role", commonAdminRpc.status >= 400);

  const ownPath = `${companyAId}/documents/qa-security-attachment.txt`;
  storagePaths.add(ownPath);
  const uploadOwn = await api(`/storage/v1/object/${bucket}/${ownPath}`, {
    method: "POST",
    key: anonKey,
    token: tokenAdminA,
    body: "QA-SECURITY attachment",
    headers: { "Content-Type": "text/plain", "x-upsert": "false" },
  });
  check("authorized upload to company path succeeds", uploadOwn.status === 200);

  const readOwn = await api(`/storage/v1/object/${bucket}/${ownPath}`, {
    key: anonKey,
    token: tokenAdminA,
  });
  check(
    "authorized read from company path succeeds",
    readOwn.status === 200 && String(readOwn.payload).includes("QA-SECURITY"),
  );

  const crossStorageRead = await api(`/storage/v1/object/${bucket}/${ownPath}`, {
    key: anonKey,
    token: tokenB,
  });
  check("cross-tenant Storage read is blocked", crossStorageRead.status >= 400);

  const crossStorageDelete = await api(`/storage/v1/object/${bucket}/${ownPath}`, {
    method: "DELETE",
    key: anonKey,
    token: tokenB,
  });
  check("cross-tenant Storage delete is blocked", crossStorageDelete.status >= 400);

  const anonStorage = await api(`/storage/v1/object/${bucket}/${ownPath}`, {
    key: anonKey,
    token: anonKey,
  });
  check("anonymous Storage access is blocked", anonStorage.status >= 400);

  const inactiveStorage = await api(`/storage/v1/object/${bucket}/${ownPath}`, {
    key: anonKey,
    token: tokenInactive,
  });
  check("inactive user Storage access is blocked", inactiveStorage.status >= 400);

  const traversalPath =
    `${companyAId}/documents/%2e%2e/%2e%2e/${companyBId}/documents/qa-traversal.txt`;
  const traversal = await api(`/storage/v1/object/${bucket}/${traversalPath}`, {
    method: "POST",
    key: anonKey,
    token: tokenAdminA,
    body: "QA-SECURITY traversal",
    headers: { "Content-Type": "text/plain" },
  });
  check("Storage path traversal is blocked", traversal.status >= 400);

  const crossSignedUrl = await api(`/storage/v1/object/sign/${bucket}/${ownPath}`, {
    method: "POST",
    key: anonKey,
    token: tokenB,
    body: { expiresIn: 60 },
  });
  check("cross-tenant signed URL creation is blocked", crossSignedUrl.status >= 400);

  const deleteOwn = await api(`/storage/v1/object/${bucket}/${ownPath}`, {
    method: "DELETE",
    key: anonKey,
    token: tokenAdminA,
  });
  check("authorized manager can delete own attachment", deleteOwn.status === 200);
  storagePaths.delete(ownPath);

  const invalidPayload = await api("/functions/v1/bootstrap-company", authOptions(
    tokenDuplicate,
    { name: "", slug: "bad slug", display_name: "" },
    { "x-idempotency-key": "qa-security-invalid-payload-0001" },
  ));
  check("bootstrap rejects invalid payload", invalidPayload.status === 400);

  const invalidAdminField = await api(
    "/functions/v1/bootstrap-company",
    authOptions(
      tokenDuplicate,
      {
        name: "QA Duplicate",
        slug: "qa-security-duplicate",
        display_name: "QA Duplicate",
        role: "owner",
      },
      { "x-idempotency-key": "qa-security-admin-field-0001" },
    ),
  );
  check("bootstrap rejects administrative fields", invalidAdminField.status === 400);

  const duplicateSlug = await bootstrap(
    tokenDuplicate,
    companyASlug,
    "QA-SECURITY-DUPLICATE",
    "qa-security-duplicate-slug-0001",
  );
  check("bootstrap rejects duplicate tenant slug", duplicateSlug.status === 409);

  const duplicateMembership = await serviceRows(
    "gm_company_members",
    `select=user_id&user_id=eq.${duplicate.id}`,
  );
  const duplicateProfile = await serviceRows(
    "gm_profiles",
    `select=user_id&user_id=eq.${duplicate.id}`,
  );
  check(
    "failed bootstrap rolls back profile and membership",
    duplicateMembership.payload?.length === 0
      && duplicateProfile.payload?.length === 0,
  );

  const rateResults = [];
  for (let index = 0; index < 12; index += 1) {
    rateResults.push(await bootstrap(
      tokenAdminA,
      companyASlug,
      "QA-SECURITY-COMPANY-A",
      `qa-security-rate-${String(index).padStart(4, "0")}`,
    ));
  }
  check(
    "bootstrap rate limit blocks excessive calls",
    rateResults.some((result) => result.status === 429),
  );

  const validRequest = {
    trade_name: "QA-SECURITY-PUBLIC-REQUEST",
    legal_name: "QA Security Public Request Ltda",
    cnpj: requestCnpj,
    responsible_name: "QA Security Requester",
    responsible_role: "QA",
    responsible_email: "qa-security-request@example.invalid",
    responsible_phone: "11999999999",
    city: "Sao Paulo",
    state: "SP",
    estimated_users: 3,
    estimated_units: 1,
    message: "QA-SECURITY onboarding validation",
    website: "",
  };
  const publicRequest = await api("/functions/v1/submit-company-request", {
    method: "POST",
    key: anonKey,
    token: anonKey,
    body: validRequest,
  });
  check("valid public company request succeeds", publicRequest.status === 201);

  const invalidEmail = await api("/functions/v1/submit-company-request", {
    method: "POST",
    key: anonKey,
    token: anonKey,
    body: { ...validRequest, responsible_email: "invalid-email" },
  });
  check("public request rejects invalid email", invalidEmail.status === 400);

  const duplicateRequest = await api("/functions/v1/submit-company-request", {
    method: "POST",
    key: anonKey,
    token: anonKey,
    body: validRequest,
  });
  check("public request rejects duplicate request", duplicateRequest.status === 409);

  const requests = await serviceRows(
    "company_requests",
    `select=id,status,cnpj&cnpj=eq.${requestCnpj}`,
  );
  const requestId = requests.payload?.[0]?.id;
  check(
    "public request persists without password",
    requests.status === 200
      && requests.payload?.length === 1
      && !JSON.stringify(requests.payload[0]).toLowerCase().includes("password"),
  );

  await serviceInsert("gm_platform_admins", {
    user_id: adminA.id,
    role: "owner",
    active: true,
  });
  check("QA platform administrator prepared for approval", true);

  const approved = await api("/rest/v1/rpc/gm_review_company_request", {
    method: "POST",
    key: anonKey,
    token: tokenAdminA,
    body: {
      p_request_id: requestId,
      p_status: "approved",
      p_internal_notes: "QA-SECURITY approved",
    },
  });
  check("platform administrator can approve QA request", approved.status === 200);

  const converted = await api("/functions/v1/convert-company-request", {
    method: "POST",
    key: anonKey,
    token: tokenAdminA,
    body: {
      request_id: requestId,
      company_slug: convertedSlug,
      admin_username: "qa.security.converted",
      admin_password: qaPassword,
    },
  });
  check("approved QA request converts into company", converted.status === 201);

  const convertedRows = await serviceRows(
    "gm_companies",
    `select=id,slug&slug=eq.${convertedSlug}`,
  );
  check(
    "converted company is consistent",
    convertedRows.status === 200 && convertedRows.payload?.length === 1,
  );

  const userList = await api("/functions/v1/manage-company-user", {
    method: "POST",
    key: anonKey,
    token: tokenAdminA,
    body: { action: "list" },
  });
  check("tenant user management Edge Function responds", userList.status === 200);

  const bucketInfo = await api(`/storage/v1/bucket/${bucket}`);
  check(
    "Storage bucket remains private",
    bucketInfo.status === 200
      && bucketInfo.payload?.id === bucket
      && bucketInfo.payload?.public === false,
  );
}

try {
  await main();
} finally {
  await cleanup();
}

const remainingCompanies = await serviceRows(
  "gm_companies",
  "select=id&slug=like.qa-security-*",
);
const remainingRequests = await serviceRows(
  "company_requests",
  `select=id&cnpj=eq.${requestCnpj}`,
);
let currentRunRateRows = [];
for (const keyHash of rateHashes) {
  const rows = await serviceRows(
    "gm_public_rate_limits",
    `select=key_hash&key_hash=eq.${encodeURIComponent(keyHash)}`,
  );
  currentRunRateRows = currentRunRateRows.concat(rows.payload || []);
}
check(
  "QA database cleanup completed",
  remainingCompanies.payload?.length === 0
    && remainingRequests.payload?.length === 0
    && currentRunRateRows.length === 0,
);

console.log(`RESULT staging-security passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
