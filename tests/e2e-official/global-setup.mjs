import fs from "node:fs";
import path from "node:path";
import {
  api,
  authEmail,
  bootstrap,
  cleanupQa,
  createAuthUser,
  env,
  fixture,
  fixtureFile,
  marker,
  rows,
  serviceInsert,
  signIn,
} from "./support/staging-api.mjs";

export default async function globalSetup() {
  await cleanupQa();

  const identities = {
    adminA: {
      slug: fixture.slugA,
      username: fixture.adminAUsername,
      email: authEmail(fixture.slugA, fixture.adminAUsername),
      displayName: `${marker}ADMIN-A`,
    },
    adminB: {
      slug: fixture.slugB,
      username: fixture.adminBUsername,
      email: authEmail(fixture.slugB, fixture.adminBUsername),
      displayName: `${marker}ADMIN-B`,
    },
    operatorA: {
      slug: fixture.slugA,
      username: fixture.operatorAUsername,
      email: authEmail(fixture.slugA, fixture.operatorAUsername),
      displayName: `${marker}OPERADOR-A`,
    },
    inactive: {
      slug: fixture.slugA,
      username: fixture.inactiveUsername,
      email: authEmail(fixture.slugA, fixture.inactiveUsername),
      displayName: `${marker}INATIVO-A`,
    },
    platform: {
      slug: "gestman",
      username: fixture.platformUsername,
      email: authEmail("gestman", fixture.platformUsername),
      displayName: `${marker}PLATFORM`,
    },
  };

  for (const identity of Object.values(identities)) {
    identity.user = await createAuthUser(identity.email, identity.displayName, {
      access_username: identity.username,
      company_slug: identity.slug,
    });
  }

  const [sessionA, sessionB] = await Promise.all([
    signIn(identities.adminA.email),
    signIn(identities.adminB.email),
  ]);
  await bootstrap(sessionA.access_token, fixture.slugA, fixture.companyAName);
  await bootstrap(sessionB.access_token, fixture.slugB, fixture.companyBName);

  const [companyARows, companyBRows] = await Promise.all([
    rows("gm_companies", `select=id,slug&slug=eq.${fixture.slugA}`),
    rows("gm_companies", `select=id,slug&slug=eq.${fixture.slugB}`),
  ]);
  const companyAId = companyARows.payload?.[0]?.id;
  const companyBId = companyBRows.payload?.[0]?.id;
  if (!companyAId || !companyBId) throw new Error("QA companies were not created.");

  const initialState = {
    regions: [{
      id: `${marker}REGION-001`,
      name: `${marker}REGIÃO`,
      x: 20,
      y: 20,
      w: 300,
      h: 220,
      color: "#2563eb",
      createdAt: Date.now(),
    }],
    locations: [{
      id: `${marker}LOCATION-001`,
      regionId: `${marker}REGION-001`,
      code: `${marker}LOC-001`,
      name: `${marker}LOCAL`,
      type: "Produção",
      x: 60,
      y: 70,
      w: 180,
      h: 120,
      color: "#0ea5e9",
      createdAt: Date.now(),
    }],
    resources: [{
      id: `${marker}RESOURCE-001`,
      code: `${marker}TEC-001`,
      name: `${marker}TECNICO`,
      type: "Técnico",
      specialty: "QA E2E",
      shift: "Administrativo",
      status: "Disponível",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }],
  };
  const stateSave = await api("/rest/v1/rpc/gm_save_tenant_state", {
    method: "POST",
    key: env.publishableKey,
    token: sessionA.access_token,
    body: { p_expected_version: 0, p_state: initialState },
  });
  if (stateSave.status !== 200) {
    throw new Error(`Initial QA tenant state failed (${stateSave.status}).`);
  }

  const profileInsert = await serviceInsert("gm_profiles", [
    {
      user_id: identities.operatorA.user.id,
      display_name: identities.operatorA.displayName,
      active: true,
      details: { qa_marker: marker },
    },
    {
      user_id: identities.inactive.user.id,
      display_name: identities.inactive.displayName,
      active: false,
      details: { qa_marker: marker },
    },
    {
      user_id: identities.platform.user.id,
      display_name: identities.platform.displayName,
      active: true,
      details: { qa_marker: marker },
    },
  ]);
  if (![200, 201].includes(profileInsert.status)) {
    throw new Error(`QA profile insert failed (${profileInsert.status}).`);
  }

  const memberInsert = await serviceInsert("gm_company_members", [
    {
      company_id: companyAId,
      user_id: identities.operatorA.user.id,
      role: "technician",
      active: true,
      access_username: identities.operatorA.username,
      access_profile: "technician",
      permission_levels: {},
    },
    {
      company_id: companyAId,
      user_id: identities.inactive.user.id,
      role: "technician",
      active: false,
      access_username: identities.inactive.username,
      access_profile: "technician",
      permission_levels: {},
    },
  ]);
  if (![200, 201].includes(memberInsert.status)) {
    throw new Error(`QA membership insert failed (${memberInsert.status}).`);
  }

  const platformInsert = await serviceInsert("gm_platform_admins", {
    user_id: identities.platform.user.id,
    role: "owner",
    active: true,
  });
  if (![200, 201].includes(platformInsert.status)) {
    throw new Error(`QA platform role insert failed (${platformInsert.status}).`);
  }

  const state = {
    marker,
    companyAId,
    companyBId,
    identities: Object.fromEntries(
      Object.entries(identities).map(([key, value]) => [
        key,
        {
          slug: value.slug,
          username: value.username,
          email: value.email,
          displayName: value.displayName,
          userId: value.user.id,
        },
      ]),
    ),
  };
  fs.mkdirSync(path.dirname(fixtureFile), { recursive: true });
  fs.writeFileSync(fixtureFile, JSON.stringify(state, null, 2), "utf8");

  const platformAudit = await api(
    `/rest/v1/gm_platform_admins?select=user_id&user_id=eq.${identities.platform.user.id}`,
  );
  if (platformAudit.payload?.length !== 1) throw new Error("Platform fixture was not persisted.");
}
