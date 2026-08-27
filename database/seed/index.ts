/**
 * ResidentPass — Development Seed Data
 *
 * Creates two communities to validate tenant isolation:
 *   1. Oak Ridge Condominiums (10 units, 1 admin, 6 residents)
 *   2. Pine Creek HOA (8 units, 1 admin, 5 residents)
 *
 * Includes a mixture of pass statuses and edge cases:
 *   - Unit at active-pass limit
 *   - Resident at monthly issuance limit
 *   - Active, scheduled, expired, revoked, and cancelled passes
 *
 * Run: npm run db:seed
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---- Deterministic record UUIDs for cross-reference ----
// Auth user IDs are replaced at runtime with IDs returned by Supabase Auth.

const IDS = {
  // Communities
  oakRidge: "a0000000-0000-0000-0000-000000000001",
  pineCreek: "a0000000-0000-0000-0000-000000000002",

  // Oak Ridge Units
  orUnit101: "b0000000-0000-0000-0000-000000000101",
  orUnit102: "b0000000-0000-0000-0000-000000000102",
  orUnit103: "b0000000-0000-0000-0000-000000000103",
  orUnit104: "b0000000-0000-0000-0000-000000000104",
  orUnit201: "b0000000-0000-0000-0000-000000000201",
  orUnit202: "b0000000-0000-0000-0000-000000000202",
  orUnit203: "b0000000-0000-0000-0000-000000000203",
  orUnit204: "b0000000-0000-0000-0000-000000000204",
  orUnit301: "b0000000-0000-0000-0000-000000000301",
  orUnit302: "b0000000-0000-0000-0000-000000000302",

  // Pine Creek Units
  pcUnit1: "b0000000-0000-0000-0000-000000001001",
  pcUnit2: "b0000000-0000-0000-0000-000000001002",
  pcUnit3: "b0000000-0000-0000-0000-000000001003",
  pcUnit4: "b0000000-0000-0000-0000-000000001004",
  pcUnit5: "b0000000-0000-0000-0000-000000001005",
  pcUnit6: "b0000000-0000-0000-0000-000000001006",
  pcUnit7: "b0000000-0000-0000-0000-000000001007",
  pcUnit8: "b0000000-0000-0000-0000-000000001008",

  // Users (these would correspond to Supabase Auth users)
  orAdmin: "c0000000-0000-0000-0000-000000000001",
  orResident1: "c0000000-0000-0000-0000-000000000002",
  orResident2: "c0000000-0000-0000-0000-000000000003",
  orResident3: "c0000000-0000-0000-0000-000000000004",
  orResident4: "c0000000-0000-0000-0000-000000000005",
  orResident5: "c0000000-0000-0000-0000-000000000006",
  orResident6: "c0000000-0000-0000-0000-000000000007",
  pcAdmin: "c0000000-0000-0000-0000-000000000011",
  pcResident1: "c0000000-0000-0000-0000-000000000012",
  pcResident2: "c0000000-0000-0000-0000-000000000013",
  pcResident3: "c0000000-0000-0000-0000-000000000014",
  pcResident4: "c0000000-0000-0000-0000-000000000015",
  pcResident5: "c0000000-0000-0000-0000-000000000016",
};

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function seed() {
  console.log("Seeding ResidentPass development data...\n");

  // ---- Supabase Auth Users ----
  // Creating real Auth identities keeps auth.uid(), RLS, and app memberships aligned.
  console.log("Creating auth users...");
  const authUsers = [
    { idKey: "orAdmin" as const, email: "admin@oakridge.example.com", fullName: "Maria Chen" },
    { idKey: "orResident1" as const, email: "alex.morgan@example.com", fullName: "Alex Morgan" },
    { idKey: "orResident2" as const, email: "jordan.lee@example.com", fullName: "Jordan Lee" },
    { idKey: "orResident3" as const, email: "sam.patel@example.com", fullName: "Sam Patel" },
    { idKey: "orResident4" as const, email: "taylor.kim@example.com", fullName: "Taylor Kim" },
    { idKey: "orResident5" as const, email: "casey.rivera@example.com", fullName: "Casey Rivera" },
    { idKey: "orResident6" as const, email: "drew.nguyen@example.com", fullName: "Drew Nguyen" },
    { idKey: "pcAdmin" as const, email: "admin@pinecreek.example.com", fullName: "James Whitfield" },
    { idKey: "pcResident1" as const, email: "robin.hayes@example.com", fullName: "Robin Hayes" },
    { idKey: "pcResident2" as const, email: "pat.sullivan@example.com", fullName: "Pat Sullivan" },
    { idKey: "pcResident3" as const, email: "chris.delgado@example.com", fullName: "Chris Delgado" },
    { idKey: "pcResident4" as const, email: "avery.brooks@example.com", fullName: "Avery Brooks" },
    { idKey: "pcResident5" as const, email: "dana.wood@example.com", fullName: "Dana Wood" },
  ];

  const { data: existingAuthData, error: listAuthError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listAuthError) throw listAuthError;

  for (const seededUser of authUsers) {
    let authUser = existingAuthData.users.find(
      (user) => user.email === seededUser.email
    );

    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: seededUser.email,
        email_confirm: true,
        user_metadata: { full_name: seededUser.fullName },
      });
      if (error) throw error;
      if (!data.user) throw new Error(`Auth user was not created: ${seededUser.email}`);
      authUser = data.user;
    }

    IDS[seededUser.idKey] = authUser.id;
  }

  // ---- Communities ----
  console.log("Creating communities...");
  const { error: commErr } = await supabase.from("communities").upsert([
    {
      id: IDS.oakRidge,
      name: "Oak Ridge Condominiums",
      slug: "oak-ridge",
      timezone: "America/New_York",
      status: "active",
    },
    {
      id: IDS.pineCreek,
      name: "Pine Creek HOA",
      slug: "pine-creek",
      timezone: "America/Chicago",
      status: "active",
    },
  ]);
  if (commErr) throw commErr;

  // ---- Parking Rules ----
  console.log("Creating parking rule sets...");
  const { error: rulesErr } = await supabase.from("parking_rule_sets").upsert(
    [
      {
        community_id: IDS.oakRidge,
        max_active_passes: 2,
        max_duration_hours: 72,
        monthly_limit: 8,
        advance_window_days: 14,
        allow_resident_cancel: true,
      },
      {
        community_id: IDS.pineCreek,
        max_active_passes: 3,
        max_duration_hours: 48,
        monthly_limit: 10,
        advance_window_days: 7,
        allow_resident_cancel: true,
      },
    ],
    { onConflict: "community_id" }
  );
  if (rulesErr) throw rulesErr;

  // ---- Units ----
  console.log("Creating units...");
  const oakUnits = [
    { id: IDS.orUnit101, community_id: IDS.oakRidge, unit_label: "101", address_label: "100 Oak Ridge Dr, Unit 101" },
    { id: IDS.orUnit102, community_id: IDS.oakRidge, unit_label: "102", address_label: "100 Oak Ridge Dr, Unit 102" },
    { id: IDS.orUnit103, community_id: IDS.oakRidge, unit_label: "103", address_label: "100 Oak Ridge Dr, Unit 103" },
    { id: IDS.orUnit104, community_id: IDS.oakRidge, unit_label: "104", address_label: "100 Oak Ridge Dr, Unit 104" },
    { id: IDS.orUnit201, community_id: IDS.oakRidge, unit_label: "201", address_label: "100 Oak Ridge Dr, Unit 201" },
    { id: IDS.orUnit202, community_id: IDS.oakRidge, unit_label: "202", address_label: "100 Oak Ridge Dr, Unit 202" },
    { id: IDS.orUnit203, community_id: IDS.oakRidge, unit_label: "203", address_label: "100 Oak Ridge Dr, Unit 203" },
    { id: IDS.orUnit204, community_id: IDS.oakRidge, unit_label: "204", address_label: "100 Oak Ridge Dr, Unit 204" },
    { id: IDS.orUnit301, community_id: IDS.oakRidge, unit_label: "301", address_label: "100 Oak Ridge Dr, Unit 301" },
    { id: IDS.orUnit302, community_id: IDS.oakRidge, unit_label: "302", address_label: "100 Oak Ridge Dr, Unit 302" },
  ];

  const pineUnits = [
    { id: IDS.pcUnit1, community_id: IDS.pineCreek, unit_label: "1", address_label: "1 Pine Creek Ln" },
    { id: IDS.pcUnit2, community_id: IDS.pineCreek, unit_label: "2", address_label: "2 Pine Creek Ln" },
    { id: IDS.pcUnit3, community_id: IDS.pineCreek, unit_label: "3", address_label: "3 Pine Creek Ln" },
    { id: IDS.pcUnit4, community_id: IDS.pineCreek, unit_label: "4", address_label: "4 Pine Creek Ln" },
    { id: IDS.pcUnit5, community_id: IDS.pineCreek, unit_label: "5", address_label: "5 Pine Creek Ln" },
    { id: IDS.pcUnit6, community_id: IDS.pineCreek, unit_label: "6", address_label: "6 Pine Creek Ln" },
    { id: IDS.pcUnit7, community_id: IDS.pineCreek, unit_label: "7", address_label: "7 Pine Creek Ln" },
    { id: IDS.pcUnit8, community_id: IDS.pineCreek, unit_label: "8", address_label: "8 Pine Creek Ln" },
  ];

  const { error: unitsErr } = await supabase.from("units").upsert([...oakUnits, ...pineUnits]);
  if (unitsErr) throw unitsErr;

  // ---- Users ----
  console.log("Creating users...");
  const { error: usersErr } = await supabase.from("users").upsert(
    authUsers.map(({ idKey, email, fullName }) => ({
      id: IDS[idKey],
      email,
      full_name: fullName,
    }))
  );
  if (usersErr) throw usersErr;

  // ---- Memberships ----
  console.log("Creating memberships...");
  const { error: memErr } = await supabase.from("memberships").upsert([
    // Oak Ridge
    { user_id: IDS.orAdmin, community_id: IDS.oakRidge, unit_id: null, role: "admin", status: "active" },
    { user_id: IDS.orResident1, community_id: IDS.oakRidge, unit_id: IDS.orUnit101, role: "resident", status: "active" },
    { user_id: IDS.orResident2, community_id: IDS.oakRidge, unit_id: IDS.orUnit102, role: "resident", status: "active" },
    { user_id: IDS.orResident3, community_id: IDS.oakRidge, unit_id: IDS.orUnit103, role: "resident", status: "active" },
    { user_id: IDS.orResident4, community_id: IDS.oakRidge, unit_id: IDS.orUnit201, role: "resident", status: "active" },
    { user_id: IDS.orResident5, community_id: IDS.oakRidge, unit_id: IDS.orUnit202, role: "resident", status: "active" },
    { user_id: IDS.orResident6, community_id: IDS.oakRidge, unit_id: IDS.orUnit203, role: "resident", status: "active" },
    // Pine Creek
    { user_id: IDS.pcAdmin, community_id: IDS.pineCreek, unit_id: null, role: "admin", status: "active" },
    { user_id: IDS.pcResident1, community_id: IDS.pineCreek, unit_id: IDS.pcUnit1, role: "resident", status: "active" },
    { user_id: IDS.pcResident2, community_id: IDS.pineCreek, unit_id: IDS.pcUnit2, role: "resident", status: "active" },
    { user_id: IDS.pcResident3, community_id: IDS.pineCreek, unit_id: IDS.pcUnit3, role: "resident", status: "active" },
    { user_id: IDS.pcResident4, community_id: IDS.pineCreek, unit_id: IDS.pcUnit4, role: "resident", status: "active" },
    { user_id: IDS.pcResident5, community_id: IDS.pineCreek, unit_id: IDS.pcUnit5, role: "resident", status: "active" },
  ], { onConflict: "user_id,community_id,role" });
  if (memErr) throw memErr;

  // ---- Parking Passes ----
  console.log("Creating parking passes...");
  const passes = [
    // Oak Ridge — Unit 101: 2 active passes (AT LIMIT for max_active=2)
    {
      public_code: "RP-7K4M-9Q2F",
      community_id: IDS.oakRidge,
      unit_id: IDS.orUnit101,
      requester_user_id: IDS.orResident1,
      plate: "ABC1234",
      plate_state: "NC",
      guest_name: "Mom",
      valid_from: hoursAgo(12),
      valid_until: hoursFromNow(60),
      status: "active",
    },
    {
      public_code: "RP-3N8R-1W5X",
      community_id: IDS.oakRidge,
      unit_id: IDS.orUnit101,
      requester_user_id: IDS.orResident1,
      plate: "XYZ5678",
      plate_state: "NC",
      guest_name: "Dad",
      valid_from: hoursAgo(6),
      valid_until: hoursFromNow(42),
      status: "active",
    },
    // Oak Ridge — Unit 102: 1 active, 1 expired
    {
      public_code: "RP-5T2L-8P4J",
      community_id: IDS.oakRidge,
      unit_id: IDS.orUnit102,
      requester_user_id: IDS.orResident2,
      plate: "DEF9012",
      plate_state: "VA",
      valid_from: hoursAgo(2),
      valid_until: hoursFromNow(22),
      status: "active",
    },
    {
      public_code: "RP-9H6V-2M7K",
      community_id: IDS.oakRidge,
      unit_id: IDS.orUnit102,
      requester_user_id: IDS.orResident2,
      plate: "GHI3456",
      plate_state: "VA",
      valid_from: hoursAgo(100),
      valid_until: hoursAgo(28),
      status: "expired",
    },
    // Oak Ridge — Unit 103: 1 revoked pass
    {
      public_code: "RP-4R1D-6N3Q",
      community_id: IDS.oakRidge,
      unit_id: IDS.orUnit103,
      requester_user_id: IDS.orResident3,
      plate: "JKL7890",
      plate_state: "NC",
      valid_from: hoursAgo(24),
      valid_until: hoursFromNow(48),
      status: "revoked",
    },
    // Oak Ridge — Unit 201: 1 scheduled (future)
    {
      public_code: "RP-8W5B-3F9Y",
      community_id: IDS.oakRidge,
      unit_id: IDS.orUnit201,
      requester_user_id: IDS.orResident4,
      plate: "MNO1234",
      plate_state: "SC",
      guest_name: "Weekend Visitor",
      valid_from: hoursFromNow(48),
      valid_until: hoursFromNow(120),
      status: "scheduled",
    },
    // Oak Ridge — Unit 202: 1 cancelled
    {
      public_code: "RP-2G7C-5K8T",
      community_id: IDS.oakRidge,
      unit_id: IDS.orUnit202,
      requester_user_id: IDS.orResident5,
      plate: "PQR5678",
      plate_state: "NC",
      valid_from: hoursFromNow(24),
      valid_until: hoursFromNow(72),
      status: "cancelled",
    },

    // Pine Creek — Unit 1: 1 active
    {
      public_code: "RP-6L4H-1S9W",
      community_id: IDS.pineCreek,
      unit_id: IDS.pcUnit1,
      requester_user_id: IDS.pcResident1,
      plate: "STU9012",
      plate_state: "TX",
      valid_from: hoursAgo(4),
      valid_until: hoursFromNow(44),
      status: "active",
    },
    // Pine Creek — Unit 2: 2 active, 1 expired
    {
      public_code: "RP-1X3Z-7V2R",
      community_id: IDS.pineCreek,
      unit_id: IDS.pcUnit2,
      requester_user_id: IDS.pcResident2,
      plate: "VWX3456",
      plate_state: "TX",
      valid_from: hoursAgo(10),
      valid_until: hoursFromNow(38),
      status: "active",
    },
    {
      public_code: "RP-5Q8P-4D6M",
      community_id: IDS.pineCreek,
      unit_id: IDS.pcUnit2,
      requester_user_id: IDS.pcResident2,
      plate: "YZA7890",
      plate_state: "TX",
      valid_from: hoursAgo(1),
      valid_until: hoursFromNow(47),
      status: "active",
    },
    {
      public_code: "RP-7J2F-9N5A",
      community_id: IDS.pineCreek,
      unit_id: IDS.pcUnit2,
      requester_user_id: IDS.pcResident2,
      plate: "BCD1234",
      plate_state: "OK",
      valid_from: hoursAgo(96),
      valid_until: hoursAgo(48),
      status: "expired",
    },
    // Pine Creek — Unit 3: 1 active pass
    {
      public_code: "RP-3M6K-8T1G",
      community_id: IDS.pineCreek,
      unit_id: IDS.pcUnit3,
      requester_user_id: IDS.pcResident3,
      plate: "EFG5678",
      plate_state: "TX",
      valid_from: hoursAgo(8),
      valid_until: hoursFromNow(40),
      status: "active",
    },
  ];

  const { error: passErr } = await supabase
    .from("parking_passes")
    .upsert(passes, { onConflict: "public_code" });
  if (passErr) throw passErr;

  // ---- Community Branding ----
  console.log("Creating community branding...");
  const { error: brandErr } = await supabase.from("community_brandings").upsert(
    [
      {
        community_id: IDS.oakRidge,
        display_name: "Oak Ridge Condominiums",
        primary_color: "#1a56db",
        footer_text: "Oak Ridge Condominium Association — Est. 2005",
      },
      {
        community_id: IDS.pineCreek,
        display_name: "Pine Creek HOA",
        primary_color: "#166534",
        footer_text: "Pine Creek Homeowners Association",
      },
    ],
    { onConflict: "community_id" }
  );
  if (brandErr) throw brandErr;

  console.log("\nSeed data created successfully!");
  console.log("  Communities: 2 (Oak Ridge, Pine Creek)");
  console.log("  Units: 18");
  console.log("  Users: 13");
  console.log("  Memberships: 13");
  console.log(`  Passes: ${passes.length}`);
  console.log("\nEdge cases seeded:");
  console.log("  - Oak Ridge Unit 101: at active-pass limit (2/2)");
  console.log("  - Includes expired, revoked, cancelled, and scheduled passes");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
