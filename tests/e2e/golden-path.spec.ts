import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const E2E_PASSWORD = "ResidentPass-E2E-2026!";
const RECOVERY_PASSWORD = "ResidentPass-Recovered-2026!";
const E2E_PLATE = "E2E1234";
const ASSIGNED_EMAIL = "e2e.assigned@example.com";
const INVITED_EMAIL = "e2e.invited@example.com";
const UNLINKED_EMAIL = "e2e.unlinked@example.com";
const MAILPIT_URL = "http://127.0.0.1:54324";

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

function floorToHalfHour(date: Date): Date {
  return new Date(Math.floor(date.getTime() / (30 * 60_000)) * 30 * 60_000);
}

test.beforeEach(async () => {
  const [{ error: passError }, { error: grantError }, { error: requestError }] = await Promise.all([
    adminClient.from("parking_passes").delete().like("plate", "E2E%"),
    adminClient
      .from("pass_allowance_grants")
      .delete()
      .eq("reason", "Automated E2E allowance"),
    adminClient.from("user_access_requests").delete().eq("email", UNLINKED_EMAIL),
  ]);
  if (passError) throw passError;
  if (grantError) throw grantError;
  if (requestError) throw requestError;
});

test.afterAll(async () => {
  const { data } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const removableUsers = data.users.filter((user) =>
    [ASSIGNED_EMAIL, INVITED_EMAIL, UNLINKED_EMAIL].includes(user.email ?? "")
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
  const passStart = floorToHalfHour(now);
  const passEnd = new Date(passStart.getTime() + 2 * 60 * 60_000);
  await residentPage.goto("/passes/new");
  await residentPage.getByLabel("Guest license plate").fill(E2E_PLATE);
  await residentPage.getByLabel("State").selectOption("NC");
  await residentPage
    .getByLabel("Valid from")
    .fill(toDateTimeLocal(passStart));
  await residentPage
    .getByLabel("Valid until")
    .fill(toDateTimeLocal(passEnd));
  await residentPage.getByRole("button", { name: "Request Pass" }).click();

  await expect(residentPage.getByRole("heading", { name: "Your pass is ready" })).toBeVisible();
  const passCodeLocator = residentPage.getByText(/^RP-[A-Z0-9]{4}-[A-Z0-9]{4}$/).first();
  await expect(passCodeLocator).toBeVisible();
  const passCode = (await passCodeLocator.innerText()).trim();
  const passId = new URL(residentPage.url()).pathname.split("/")[2];

  const verifierContext = await browser.newContext({ baseURL: APP_URL });
  const verifierPage = await verifierContext.newPage();
  await verifierPage.goto(`/verify/${passCode}`);
  await expect(verifierPage.getByRole("heading", { name: "VALID" })).toBeVisible();
  await expect(verifierPage.getByText(E2E_PLATE)).toBeVisible();
  await expect(verifierPage.getByText("1", { exact: true })).toBeVisible();
  await expect(verifierPage.getByText("No previous verifications")).toBeVisible();

  await verifierPage.reload();
  await expect(verifierPage.getByText("2", { exact: true })).toBeVisible();
  await expect(
    verifierPage.getByText(
      "Recently verified — confirm this pass is being used with the correct vehicle."
    )
  ).toBeVisible();

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

  await residentPage.reload();
  await expect(residentPage.getByText("Printing is unavailable for revoked passes.")).toBeVisible();
  await expect(
    residentPage.getByRole("link", { name: "Print / Save as PDF" })
  ).toHaveCount(0);

  await residentPage.goto(`/passes/${passId}/print`);
  await expect(
    residentPage.getByText("This pass is revoked. Printing and saving are no longer available.")
  ).toBeVisible();
  await expect(
    residentPage.getByRole("button", { name: "Print / Save as PDF" })
  ).toHaveCount(0);

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
  const passStart = floorToHalfHour(now);
  const passEnd = new Date(passStart.getTime() + 2 * 60 * 60_000);
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
    .fill(toDateTimeLocal(passStart));
  await page
    .getByLabel("Valid until")
    .fill(toDateTimeLocal(passEnd));
  await page.getByRole("button", { name: "Request Pass" }).click();

  await expect(
    page.getByText("This unit has reached its limit of 8 passes in the past 30 days.")
  ).toBeVisible();
  await expect(page.getByLabel("Guest license plate")).toHaveValue(E2E_PLATE);
  await expect(page.getByLabel("State")).toHaveValue("NC");
  await expect(page.getByLabel("Valid from")).not.toHaveValue("");
  await expect(page.getByLabel("Valid until")).not.toHaveValue("");

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
    .fill(toDateTimeLocal(passStart));
  await page
    .getByLabel("Valid until")
    .fill(toDateTimeLocal(passEnd));
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
  await page.getByRole("button", { name: "Assign or invite resident" }).click();

  await expect(
    page.getByText(
      `${ASSIGNED_EMAIL} is now assigned to the selected unit. If they do not know their password, they can reset it from the sign-in page.`
    )
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

test("an admin can invite a new resident and reserve their unit", async ({
  browser,
  page,
  request,
}) => {
  const { data: existingUsers } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const oldUser = existingUsers.users.find((user) => user.email === INVITED_EMAIL);
  if (oldUser) {
    await adminClient.from("users").delete().eq("id", oldUser.id);
    await adminClient.auth.admin.deleteUser(oldUser.id);
  }

  const inboxBefore = await request.get(`${MAILPIT_URL}/api/v1/messages`);
  expect(inboxBefore.ok()).toBeTruthy();
  const existingMessageIds = new Set<string>(
    ((await inboxBefore.json()).messages ?? []).map(
      (message: { ID: string }) => message.ID
    )
  );

  await signInWithPassword(
    page,
    "admin@oakridge.example.com",
    /\/admin\/dashboard$/
  );
  await page.goto("/admin/units");
  await page.getByLabel("Resident email").fill(INVITED_EMAIL);
  await page.getByLabel("Resident name").fill("E2E Invited Resident");
  await page.locator("#resident_unit_id").selectOption({
    label: "104 — 100 Oak Ridge Dr, Unit 104",
  });
  await page
    .getByRole("button", { name: "Assign or invite resident" })
    .click();

  await expect(
    page.getByText(
      `Invitation sent to ${INVITED_EMAIL}. The selected unit is reserved until account setup is complete.`
    )
  ).toBeVisible();

  const { data: invitedProfile, error: profileError } = await adminClient
    .from("users")
    .select("id")
    .eq("email", INVITED_EMAIL)
    .single();
  if (profileError) throw profileError;

  const { data: invitedMembership, error: membershipError } = await adminClient
    .from("memberships")
    .select("status, units(unit_label)")
    .eq("user_id", invitedProfile.id)
    .single();
  if (membershipError) throw membershipError;
  expect(invitedMembership.status).toBe("invited");
  expect(
    (invitedMembership.units as unknown as { unit_label: string }).unit_label
  ).toBe("104");

  let messageId: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(`${MAILPIT_URL}/api/v1/messages`);
      const inbox = await response.json();
      const message = (inbox.messages ?? []).find(
        (candidate: { ID: string; To: Array<{ Address: string }> }) =>
          !existingMessageIds.has(candidate.ID) &&
          candidate.To.some((recipient) => recipient.Address === INVITED_EMAIL)
      );
      messageId = message?.ID;
      return Boolean(messageId);
    })
    .toBe(true);

  const messageResponse = await request.get(
    `${MAILPIT_URL}/api/v1/message/${messageId}`
  );
  const message = await messageResponse.json();
  const invitationLink = (message.Text as string).match(/https?:\/\/[^\s)]+/)?.[0];
  expect(invitationLink).toBeTruthy();

  // Reproduce the hosted fallback that exposed the regression: if Supabase
  // returns an accepted invite to the app root, ResidentPass must preserve the
  // invite session and route it to first-password setup instead of login.
  const rootRedirectLink = new URL(invitationLink!);
  rootRedirectLink.searchParams.set("redirect_to", APP_URL);
  const inviteContext = await browser.newContext({ baseURL: APP_URL });
  const invitePage = await inviteContext.newPage();
  await invitePage.goto(rootRedirectLink.toString());
  await expect(invitePage).toHaveURL(/\/auth\/set-password$/);
  await invitePage.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await invitePage.getByLabel("Confirm password").fill(E2E_PASSWORD);
  await invitePage
    .getByRole("button", { name: "Set password and continue" })
    .click();
  await expect(invitePage).toHaveURL(/\/dashboard$/);

  const { data: activatedMembership, error: activationError } = await adminClient
    .from("memberships")
    .select("status")
    .eq("user_id", invitedProfile.id)
    .single();
  if (activationError) throw activationError;
  expect(activatedMembership.status).toBe("active");
  await inviteContext.close();
});

test("a public account request reaches the admin inbox without creating access", async ({
  browser,
  page,
}) => {
  const { data: existingUsers } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const oldUser = existingUsers.users.find((user) => user.email === UNLINKED_EMAIL);
  if (oldUser) {
    await adminClient.from("users").delete().eq("id", oldUser.id);
    await adminClient.auth.admin.deleteUser(oldUser.id);
  }

  await page.goto("/auth/sign-in");
  await expect(page.getByRole("tab", { name: "Create account" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Request account" }).click();
  await page.getByLabel("Name").fill("E2E Requesting Resident");
  await page.getByLabel("Email").fill(UNLINKED_EMAIL);
  await page.getByLabel("Unit address").fill("100 Oak Ridge Dr, Unit 301");
  await page.getByLabel("Community").selectOption({ label: "Oak Ridge Condominiums" });
  await page.getByRole("button", { name: "Request access" }).click();
  await expect(
    page.getByText("Your request was sent to the Oak Ridge Condominiums administrators.")
  ).toBeVisible();

  const { data: usersAfterRequest } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  expect(usersAfterRequest.users.some((user) => user.email === UNLINKED_EMAIL)).toBe(false);

  const { data: pendingRequest, error: pendingRequestError } = await adminClient
    .from("user_access_requests")
    .select("id, requester_user_id, status")
    .eq("email", UNLINKED_EMAIL)
    .single();
  if (pendingRequestError) throw pendingRequestError;
  expect(pendingRequest.requester_user_id).toBeNull();
  expect(pendingRequest.status).toBe("pending");

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email: UNLINKED_EMAIL,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (createError) throw createError;

  const adminContext = await browser.newContext({ baseURL: APP_URL });
  const adminPage = await adminContext.newPage();
  await signInWithPassword(
    adminPage,
    "admin@oakridge.example.com",
    /\/admin\/dashboard$/
  );
  await adminPage.getByLabel("1 pending user request").click();
  await expect(adminPage).toHaveURL(/\/admin\/user-requests$/);
  await expect(adminPage.getByText(UNLINKED_EMAIL)).toBeVisible();
  await expect(adminPage.getByText("100 Oak Ridge Dr, Unit 301")).toBeVisible();

  await adminPage.getByRole("button", { name: "E2E Requesting Resident" }).click();
  const requestDialog = adminPage.getByRole("dialog", {
    name: "E2E Requesting Resident",
  });
  await expect(requestDialog).toBeVisible();
  await expect(requestDialog.getByText(UNLINKED_EMAIL)).toBeVisible();
  await expect(
    requestDialog.getByText("100 Oak Ridge Dr, Unit 301", { exact: true })
  ).toBeVisible();
  await expect(requestDialog.getByText("Oak Ridge Condominiums")).toBeVisible();
  await expect(requestDialog.getByText("pending", { exact: true })).toBeVisible();
  await expect(requestDialog.getByLabel("Unit").locator("option:checked")).toHaveText(
    "301 — 100 Oak Ridge Dr, Unit 301"
  );
  await requestDialog.getByRole("button", { name: "Assign to Unit" }).click();
  await expect(adminPage.getByText("No pending user requests")).toBeVisible();
  await expect(adminPage.getByLabel("No pending user requests")).toBeVisible();
  await expect(requestDialog).toHaveCount(0);

  const { data: approvedRequest, error: requestError } = await adminClient
    .from("user_access_requests")
    .select("status, requester_user_id, reviewed_by_user_id, reviewed_at")
    .eq("email", UNLINKED_EMAIL)
    .single();
  if (requestError) throw requestError;
  expect(approvedRequest.status).toBe("approved");
  expect(approvedRequest.requester_user_id).toBe(createdUser.user!.id);
  expect(approvedRequest.reviewed_by_user_id).not.toBeNull();
  expect(approvedRequest.reviewed_at).not.toBeNull();

  const { data: assignedMembership, error: assignedMembershipError } = await adminClient
    .from("memberships")
    .select("unit_id, status, units(address_label)")
    .eq("user_id", createdUser.user!.id)
    .eq("role", "resident")
    .single();
  if (assignedMembershipError) throw assignedMembershipError;
  expect(assignedMembership.status).toBe("active");
  expect(
    (assignedMembership.units as unknown as { address_label: string }).address_label
  ).toBe("100 Oak Ridge Dr, Unit 301");
  await adminContext.close();
});

test("an existing user can establish a password through recovery", async ({
  page,
  request,
}) => {
  const recoveryEmail = "drew.nguyen@example.com";
  const inboxBefore = await request.get(`${MAILPIT_URL}/api/v1/messages`);
  expect(inboxBefore.ok()).toBeTruthy();
  const existingMessageIds = new Set<string>(
    ((await inboxBefore.json()).messages ?? []).map(
      (message: { ID: string }) => message.ID
    )
  );

  await page.goto("/auth/sign-in");
  await page.getByLabel("Email address").fill(recoveryEmail);
  await page.getByRole("button", { name: "Forgot or need a password?" }).click();
  await expect(
    page.getByText(
      "If that email has a ResidentPass account, a password setup link is on its way."
    )
  ).toBeVisible();

  let messageId: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(`${MAILPIT_URL}/api/v1/messages`);
      const inbox = await response.json();
      const message = (inbox.messages ?? []).find(
        (candidate: { ID: string; To: Array<{ Address: string }> }) =>
          !existingMessageIds.has(candidate.ID) &&
          candidate.To.some((recipient) => recipient.Address === recoveryEmail)
      );
      messageId = message?.ID;
      return Boolean(messageId);
    })
    .toBe(true);

  const messageResponse = await request.get(
    `${MAILPIT_URL}/api/v1/message/${messageId}`
  );
  const message = await messageResponse.json();
  const recoveryLink = (message.Text as string).match(/https?:\/\/[^\s)]+/)?.[0];
  expect(recoveryLink).toBeTruthy();

  await page.goto(recoveryLink!);
  await expect(page).toHaveURL(/\/auth\/set-password$/);
  await page.getByLabel("Password", { exact: true }).fill(RECOVERY_PASSWORD);
  await page.getByLabel("Confirm password").fill(RECOVERY_PASSWORD);
  await page.getByRole("button", { name: "Set password and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
