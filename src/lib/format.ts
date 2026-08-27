/**
 * Date/time display helpers.
 * All timestamps are stored in UTC and rendered in the community's timezone.
 */

import { formatInTimeZone } from "date-fns-tz";

export function formatDateTime(
  isoString: string,
  timezone: string = "America/New_York"
): string {
  return formatInTimeZone(new Date(isoString), timezone, "MMM d, yyyy h:mm a zzz");
}

export function formatDate(
  isoString: string,
  timezone: string = "America/New_York"
): string {
  return formatInTimeZone(new Date(isoString), timezone, "MMM d, yyyy");
}

export function formatTime(
  isoString: string,
  timezone: string = "America/New_York"
): string {
  return formatInTimeZone(new Date(isoString), timezone, "h:mm a");
}

/** Compact range like "Aug 27, 2:00 PM → Aug 29, 2:00 PM EDT" */
export function formatValidityWindow(
  from: string,
  until: string,
  timezone: string = "America/New_York"
): string {
  const f = formatInTimeZone(new Date(from), timezone, "MMM d, h:mm a");
  const u = formatInTimeZone(new Date(until), timezone, "MMM d, h:mm a zzz");
  return `${f} → ${u}`;
}
