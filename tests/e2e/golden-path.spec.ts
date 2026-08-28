import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const E2E_PASSWORD = "ResidentPass-E2E-2026!";
const E2E_PLATE = "E2E1234";
const ASSIGNED_EMAIL = "e2e.assigned@example.com";
const SIGNUP_EMAIL = "e2e.signup@example.com";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function signInWithPassword(
  page: Page,
  email: string,
  destination: RegExp
) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(destination);
}

function toDateTimeLocal(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

test.beforeEach(async () => {
  const [{ error: passError }, { error: grantError }] = await Promise.all([
    adminClient.from("parking_passes").delete().like("plate", "E2E%"),
    adminClient
      .from("pass_allowance_grants")
      .delete()
      .eq("reason", "Automated E2E allowance"),
  ]);
  if (passError) throw passError;
  if (grantError) throw grantError;
});

test.afterAll(async () => {
  const { data } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const removableUsers = data.users.filter((user) =>
    [ASSIGNED_EMAIL, SIGNUP_EMAIL].includes(user.email ?? "")
  );
  for (const user of removableUsers) {
    await adminClient.from("users").delete().eq("id", user.id);
    await adminClient.auth.admin.deleteUser(user.id);
  }
});

test("resident issues a pass, enforcement verifies it, and admin revokes it", async ({
  browser,
}) => {
  const residentContext = await browser.newContext({ baseURL: APP_URL });
  const residentPage = await residentContext.newPage();

  await signInWithPassword(
    residentPage,
    "drew.nguyen@example.com",
    /\/dashboard$/
  );

  const now = new Date();
  await residentPage.goto("/passes/new");
  await residentPage.getByLabel("Guest license plate").fill(E2E_PLATE);
  await residentPage.getByLabel("State").selectOption("NC");
  await residentPage
    .getByLabel("Valid from")
    .fill(toDateTimeLocal(new Date(now.getTime() - 5 * 60_000)));
  await residentPage
    .getByLabel("Valid until")
    .fill(toDateTimeLocal(new Date(now.getTime() + 2 * 60 * 60_000)));
  await residentPage.getByRole("button", { name: "Request Pass" }).click();

  await expect(residentPage.getByRole("heading", { name: "Your pass is ready" })).toBeVisible();
  const passCodeLocator = residentPage.getByText(/^RP-[A-Z0-9]{4}-[A-Z0-9]{4}$/).first();
  await expect(passCodeLocator).toBeVisible();
  const passCode = (await passCodeLocator.innerText()).trim();

  const verifierContext = await browser.newContext({ baseURL: APP_URL });
  const verifierPage = await verifierContext.newPage();
  await verifierPage.goto(`/verify/${passCode}`);
  await expect(verifierPage.getByRole("heading", { name: "VALID" })).toBeVisible();
  await expect(verifierPage.getByText(E2E_PLATE)).toBeVisible();

  const adminContext = await browser.newContext({ baseURL: APP_URL });
  const adminPage = await adminContext.newPage();
  await signInWithPassword(
    adminPage,
    "admin@oakridge.example.com",
    /\/admin\/dashboard$/
  );
  await adminPage.goto(`/admin/passes?q=${E2E_PLATE}`);
  await adminPage.getByRole("link", { name: passCode }).click();
  await adminPage.getByRole("button", { name: "Revoke this pass" }).click();
  await adminPage.getByLabel("Reason (optional, recorded in the audit log)").fill("Automated E2E test");
  await adminPage.getByRole("button", { name: "Confirm revoke" }).click();
  await expect(adminPage.getByText("Revoked", { exact: true })).toBeVisible();
  await expect(adminPage.getByText("Automated E2E test")).toBeVisible();

  await verifierPage.reload();
  await expect(verifierPage.getByRole("heading", { name: "REVOKED" })).toBeVisible();

  await Promise.all([
    residentContext.close(),
    verifierContext.close(),
    adminContext.close(),
  ]);
});

test("cancelled passes still consume the rolling monthly allowance", async ({
  browser,
  page,
}) => {
  const { data: resident, error: residentError } = await adminClient
    .from("users")
    .select("id")
    .eq("email", "drew.nguyen@example.com")
    .single();
  if (residentError) throw residentError;

  const { data: membership, error: membershipError } = await adminClient
    .from("memberships")
    .select("unit_id, community_id")
    .eq("user_id", resident.id)
    .eq("role", "resident")
    .single();
  if (membershipError) throw membershipError;

  const now = new Date();
  const { error: insertError } = await adminClient.from("parking_passes").insert(
    Array.from({ length: 8 }, (_, index) => ({
      public_code: `RP-E2E${index + 1}-M${String(index + 1).padStart(3, "0")}`,
      community_id: membership.community_id,
      unit_id: membership.unit_id,
      requester_user_id: resident.id,
      plate: `E2EM${String(index + 1).padStart(3, "0")}`,
      plate_state: "NC",
      valid_from: new Date(now.getTime() - 24 * 60 * 60_000).toISOString(),
      valid_until: new Date(now.getTime() - 23 * 60 * 60_000).toISOString(),
      status: "cancelled",
    }))
  );
  if (insertError) throw insertError;

  await signInWithPassword(
    page,
    "drew.nguyen@example.com",
    /\/dashboard$/
  );
  await page.goto("/passes/new");
  await page.getByLabel("Guest license plate").fill(E2E_PLATE);
  await page.getByLabel("State").selectOption("NC");
  await page
    .getByLabel("Valid from")
    .fill(toDateTimeLocal(new Date(now.getTime() - 5 * 60_000)));
  await page
    .getByLabel("Valid until")
    .fill(toDateTimeLocal(new Date(now.getTime() + 2 * 60 * 60_000)));
  await page.getByRole("button", { name: "Request Pass" }).click();

  await expect(
    page.getByText("This unit has reached its limit of 8 passes in the past 30 days.")
  ).toBeVisible();

  const { count, error: countError } = await adminClient
    .from("parking_passes")
    .select("id", { count: "exact", head: true })
    .eq("plate", E2E_PLATE);
  if (countError) throw countError;
  expect(count).toBe(0);

  const adminContext = await browser.newContext({ baseURL: APP_URL });
  const adminPage = await adminContext.newPage();
  await signInWithPassword(
    adminPage,
    "admin@oakridge.example.com",
    /\/admin\/dashboard$/
  );
  await adminPage.goto("/admin/units");
  await adminPage.getByLabel("Additional passes for Drew Nguyen").fill("1");
  await adminPage.getByLabel("Valid days for Drew Nguyen").fill("30");
  await adminPage
    .getByLabel("Approval reason for Drew Nguyen")
    .fill("Automated E2E allowance");
  await adminPage.getByLabel("Approve allowance for Drew Nguyen").click();
  await expect(
    adminPage.getByText("1 additional pass approved for 30 days.")
  ).toBeVisible();

  await page.reload();
  await page.getByLabel("Guest license plate").fill(E2E_PLATE);
  await page.getByLabel("State").selectOption("NC");
  await page
    .getByLabel("Valid from")
    .fill(toDateTimeLocal(new Date(now.getTime() - 5 * 60_000)));
  await page
    .getByLabel("Valid until")
    .fill(toDateTimeLocal(new Date(now.getTime() + 2 * 60 * 60_000)));
  await page.getByRole("button", { name: "Request Pass" }).click();
  await expect(page.getByRole("heading", { name: "Your pass is ready" })).toBeVisible();

  await adminContext.close();
});

test("an Oak Ridge admin cannot access a Pine Creek pass", async ({ page }) => {
  const { data: pinePass, error } = await adminClient
    .from("parking_passes")
    .select("id")
    .eq("public_code", "RP-6L4H-1S9W")
    .single();
  if (error) throw error;

  await signInWithPassword(
    page,
    "admin@oakridge.example.com",
    /\/admin\/dashboard$/
  );

  const response = await page.goto(`/admin/passes/${pinePass.id}`);
  expect(response?.status()).toBe(404);
});

test("an admin can assign an existing resident account to a unit", async ({ page }) => {
  const { data: existingUsers } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const oldUser = existingUsers.users.find((user) => user.email === ASSIGNED_EMAIL);
  if (oldUser) {
    await adminClient.from("users").delete().eq("id", oldUser.id);
    await adminClient.auth.admin.deleteUser(oldUser.id);
  }
  const { error: createError } = await adminClient.auth.admin.createUser({
    email: ASSIGNED_EMAIL,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (createError) throw createError;

  await signInWithPassword(
    page,
    "admin@oakridge.example.com",
    /\/admin\/dashboard$/
  );

  await page.goto("/admin/units");
  await page.getByLabel("Resident email").fill(ASSIGNED_EMAIL);
  await page.getByLabel("Resident name").fill("E2E Assigned Resident");
  await page.locator("#resident_unit_id").selectOption({ label: "104 — 100 Oak Ridge Dr, Unit 104" });
  await page.getByRole("button", { name: "Assign resident" }).click();

  await expect(
    page.getByText(`${ASSIGNED_EMAIL} is now assigned to the selected unit.`)
  ).toBeVisible();

  const { data: assignedUser, error: userError } = await adminClient
    .from("users")
    .select("id")
    .eq("email", ASSIGNED_EMAIL)
    .single();
  if (userError) throw userError;

  const { data: membership, error: membershipError } = await adminClient
    .from("memberships")
    .select("role, status, units(unit_label)")
    .eq("user_id", assignedUser.id)
    .single();
  if (membershipError) throw membershipError;

  expect(membership.role).toBe("resident");
  expect(membership.status).toBe("active");
  expect((membership.units as unknown as { unit_label: string }).unit_label).toBe("104");
});

test("a resident can create a password account without email confirmation", async ({ page }) => {
  const { data: existingUsers } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const oldUser = existingUsers.users.find((user) => user.email === SIGNUP_EMAIL);
  if (oldUser) {
    await adminClient.from("users").delete().eq("id", oldUser.id);
    await adminClient.auth.admin.deleteUser(oldUser.id);
  }

  await page.goto("/auth/sign-in");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Email address").fill(SIGNUP_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByLabel("Confirm password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "No residence linked to your account" })
  ).toBeVisible();

  const { data: profile, error: profileError } = await adminClient
    .from("users")
    .select("email, status")
    .eq("email", SIGNUP_EMAIL)
    .single();
  if (profileError) throw profileError;
  expect(profile.status).toBe("active");
});
