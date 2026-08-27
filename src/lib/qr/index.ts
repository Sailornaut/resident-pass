import QRCode from "qrcode";

export { generatePassCode, normalizePassCode, isValidPassCodeFormat } from "./pass-code";

/**
 * Build the public verification URL for a pass.
 * The QR payload contains ONLY the public code — never resident data.
 */
export function verificationUrl(publicCode: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/verify/${encodeURIComponent(publicCode)}`;
}

/**
 * Generate a QR code as a data URL (PNG) for embedding in pages
 * and the printable pass. High error correction so it scans through
 * a windshield.
 */
export async function generateQrDataUrl(publicCode: string): Promise<string> {
  return QRCode.toDataURL(verificationUrl(publicCode), {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 320,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/** Generate a QR code as an SVG string (crisper for print). */
export async function generateQrSvg(publicCode: string): Promise<string> {
  return QRCode.toString(verificationUrl(publicCode), {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
  });
}
