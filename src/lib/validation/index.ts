import { z } from "zod";

/** US/CA state and province codes plus a catch-all "OTHER". */
export const PLATE_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","AB","BC","MB","NB","NL","NS","ON","PE","QC",
  "SK","OTHER",
] as const;

export const createPassSchema = z
  .object({
    unit_id: z.string().uuid("Select a valid unit"),
    plate: z
      .string()
      .trim()
      .min(2, "License plate is required")
      .max(10, "Plate looks too long")
      .regex(/^[A-Za-z0-9 -]+$/, "Plate may only contain letters, numbers, spaces, and dashes")
      .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
    plate_state: z.enum(PLATE_STATES, { message: "Select the plate's state" }),
    vehicle_make: z.string().trim().max(40).optional().or(z.literal("")),
    vehicle_color: z.string().trim().max(20).optional().or(z.literal("")),
    guest_name: z.string().trim().max(80).optional().or(z.literal("")),
    note: z.string().trim().max(200).optional().or(z.literal("")),
    valid_from: z.string().datetime({ offset: true, message: "Invalid start date/time" }),
    valid_until: z.string().datetime({ offset: true, message: "Invalid end date/time" }),
  })
  .refine((data) => new Date(data.valid_until) > new Date(data.valid_from), {
    message: "End time must be after start time",
    path: ["valid_until"],
  });

export type CreatePassFormData = z.infer<typeof createPassSchema>;

export const revokePassSchema = z.object({
  pass_id: z.string().uuid(),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
});

export const updateRulesSchema = z.object({
  max_active_passes: z.coerce.number().int().min(1).max(20),
  max_duration_hours: z.coerce.number().int().min(1).max(24 * 30),
  monthly_limit: z.coerce.number().int().min(1).max(100),
  advance_window_days: z.coerce.number().int().min(0).max(90),
  allow_resident_cancel: z.coerce.boolean(),
});

export const createUnitSchema = z.object({
  unit_label: z.string().trim().min(1, "Unit label is required").max(30),
  address_label: z.string().trim().max(120).optional().or(z.literal("")),
});

export const inviteResidentSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  full_name: z.string().trim().max(80).optional().or(z.literal("")),
  unit_id: z.string().uuid("Select a unit"),
});

export const grantPassAllowanceSchema = z.object({
  additional_passes: z.coerce.number().int().min(1).max(20),
  valid_days: z.coerce.number().int().min(1).max(90),
  reason: z.string().trim().min(2, "Enter a brief approval reason").max(300),
});

export const createCommunitySchema = z.object({
  name: z.string().trim().min(2, "Community name is required").max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and dashes"),
  timezone: z.string().trim().min(1, "Timezone is required"),
});

/** Flatten a ZodError into { field: message } for form display. */
export function flattenErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
