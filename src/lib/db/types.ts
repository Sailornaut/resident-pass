// ============================================================
// ResidentPass — Core Database Types
// ============================================================

// --- Enums ---

export type CommunityStatus = "active" | "inactive" | "suspended";
export type UnitStatus = "active" | "inactive";
export type UserStatus = "active" | "inactive" | "suspended";
export type MembershipStatus = "active" | "inactive" | "invited";
export type MembershipRole = "resident" | "admin" | "verifier" | "platform_admin";

export type PassStatus =
  | "scheduled"
  | "active"
  | "expired"
  | "revoked"
  | "cancelled";

export type PassEventType =
  | "created"
  | "activated"
  | "expired"
  | "revoked"
  | "cancelled"
  | "verified"
  | "verification_failed";

// --- Entities ---

export interface ManagementCompany {
  id: string;
  name: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Community {
  id: string;
  management_company_id: string | null;
  name: string;
  slug: string;
  timezone: string;
  status: CommunityStatus;
  created_at: string;
  updated_at: string;
}

export interface CommunityBranding {
  id: string;
  community_id: string;
  display_name: string | null;
  logo_url: string | null;
  primary_color: string;
  footer_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  community_id: string;
  unit_label: string;
  address_label: string | null;
  status: UnitStatus;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  community_id: string;
  unit_id: string | null;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
}

export interface ParkingRuleSet {
  id: string;
  community_id: string;
  max_active_passes: number;
  max_duration_hours: number;
  monthly_limit: number;
  advance_window_days: number;
  allow_resident_cancel: boolean;
  created_at: string;
  updated_at: string;
}

export interface PassAllowanceGrant {
  id: string;
  community_id: string;
  user_id: string;
  granted_by_user_id: string;
  additional_passes: number;
  reason: string | null;
  expires_at: string;
  created_at: string;
}

export interface ParkingPass {
  id: string;
  public_code: string;
  community_id: string;
  unit_id: string;
  requester_user_id: string;
  plate: string;
  plate_state: string;
  vehicle_make: string | null;
  vehicle_color: string | null;
  guest_name: string | null;
  note: string | null;
  valid_from: string;
  valid_until: string;
  status: PassStatus;
  created_at: string;
  updated_at: string;
}

export interface PassEvent {
  id: string;
  pass_id: string;
  actor_user_id: string | null;
  event_type: PassEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

// --- Effective pass status (computed) ---

export type EffectivePassStatus =
  | "not_yet_valid"
  | "active"
  | "expired"
  | "revoked"
  | "cancelled";

// --- API / form types ---

export interface CreatePassInput {
  unit_id: string;
  plate: string;
  plate_state: string;
  vehicle_make?: string;
  vehicle_color?: string;
  guest_name?: string;
  note?: string;
  valid_from: string; // ISO 8601
  valid_until: string; // ISO 8601
}

export interface RevokePassInput {
  reason?: string;
}

export interface UpdateRulesInput {
  max_active_passes?: number;
  max_duration_hours?: number;
  monthly_limit?: number;
  advance_window_days?: number;
  allow_resident_cancel?: boolean;
}

export interface VerificationResult {
  status: EffectivePassStatus | "not_found";
  community_name?: string;
  plate?: string;
  plate_state?: string;
  valid_from?: string;
  valid_until?: string;
  public_code?: string;
}
