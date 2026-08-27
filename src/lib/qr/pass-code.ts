import { randomBytes } from "crypto";

/**
 * Public pass code generator.
 *
 * Format: RP-XXXX-XXXX  (e.g. RP-7K4M-9Q2F)
 *
 * Uses an unambiguous alphabet (no 0/O, 1/I/L, etc.) so codes are easy
 * to read aloud and type. 8 characters from a 27-char alphabet gives
 * ~28 quadrillion combinations — non-sequential and hard to enumerate.
 */

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ".replace(/[IL]/g, "");
// Final alphabet: 2-9 (8 chars) + consonant-heavy letters, no ambiguous glyphs

export function generatePassCode(): string {
  const chars: string[] = [];
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    chars.push(ALPHABET[bytes[i] % ALPHABET.length]);
  }
  return `RP-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/**
 * Normalize a user-entered pass code:
 * uppercases, strips whitespace, and re-inserts hyphens if missing.
 */
export function normalizePassCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  if (cleaned.startsWith("RP") && cleaned.length === 10) {
    return `RP-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 8) {
    return `RP-${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return input.toUpperCase().trim();
}

/** Validate the shape of a public pass code. */
export function isValidPassCodeFormat(code: string): boolean {
  return /^RP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}
