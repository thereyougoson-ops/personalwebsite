// IAB TCF v2 consent-string decoder (core segment only).
// Decodes the `euconsent-v2` cookie / IABTCF_TCString to surface how many
// data-use purposes and ad vendors the user has consented to. Bit layout per the
// IAB TCF v2.2 spec; verified bit-exact against the official @iabtcf/core library.

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function bitsOf(seg) {
  const bits = [];
  for (const ch of seg) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    for (let i = 5; i >= 0; i--) bits.push((v >> i) & 1);
  }
  return bits;
}
function readInt(bits, off, len) {
  let v = 0;
  for (let i = 0; i < len; i++) v = v * 2 + (bits[off + i] || 0);
  return v;
}

/**
 * Decode a TCF v2 consent string's core segment.
 * @returns {object|null} { version, cmpId, language, vendorListVersion,
 *   numPurposes, purposes[], purposesTotal, vendorCount, maxVendorId, createdMs }
 */
export function decodeTCString(tc) {
  try {
    if (!tc || typeof tc !== "string") return null;
    const bits = bitsOf(tc.split(".")[0]);
    if (bits.length < 230) return null;
    const version = readInt(bits, 0, 6);
    if (version !== 2) return null;

    const created = readInt(bits, 6, 36); // deciseconds since epoch
    const cmpId = readInt(bits, 78, 12);
    const language = String.fromCharCode(65 + readInt(bits, 108, 6)) + String.fromCharCode(65 + readInt(bits, 114, 6));
    const vendorListVersion = readInt(bits, 120, 12);

    // Purpose consents: 24 bits at offset 152.
    const purposes = [];
    for (let i = 0; i < 24; i++) if (bits[152 + i]) purposes.push(i + 1);

    const maxVendorId = readInt(bits, 213, 16);
    const isRange = bits[229];
    let vendorCount = 0;
    if (!isRange) {
      for (let i = 0; i < maxVendorId; i++) if (bits[230 + i]) vendorCount++;
    } else {
      const numEntries = readInt(bits, 230, 12);
      let off = 242;
      for (let e = 0; e < numEntries; e++) {
        const isARange = bits[off]; off += 1;
        const start = readInt(bits, off, 16); off += 16;
        if (isARange) { const end = readInt(bits, off, 16); off += 16; vendorCount += (end - start + 1); }
        else { vendorCount += 1; }
      }
    }

    return {
      version, cmpId, language, vendorListVersion,
      numPurposes: purposes.length, purposes, purposesTotal: 24,
      vendorCount, maxVendorId, createdMs: created * 100
    };
  } catch (e) { return null; }
}

/**
 * Validate a value that is being used AS a consent string (e.g. the euconsent-v2
 * cookie). Real ad-tech abuse has hidden non-consent payloads (browser
 * fingerprints) inside fake TCF strings ("Voldrakus", DEF CON 30). We can't prove
 * intent, but we CAN flag a value that is presented as a consent string yet does
 * not decode to a plausible IAB TCF v2 structure. Honest statuses, no overclaim:
 *   valid | legacy (v1) | suspicious (decodes but implausible) | invalid | none
 * @returns {{status:string, reason?:string, decoded?:object}}
 */
export function validateTCString(tc) {
  if (!tc || typeof tc !== "string") return { status: "none" };
  const seg = tc.split(".")[0];
  if (!/^[A-Za-z0-9\-_]+$/.test(seg) || seg.length < 8) return { status: "invalid", reason: "not a base64url consent string" };
  const bits = bitsOf(seg);
  const version = bits.length >= 6 ? readInt(bits, 0, 6) : -1;
  if (version === 1) return { status: "legacy", reason: "older TCF v1 format (not abuse, just outdated)" };
  if (version !== 2) return { status: "invalid", reason: `version field reads ${version}, not TCF v2` };
  const decoded = decodeTCString(tc);
  if (!decoded) return { status: "invalid", reason: "doesn't decode to a valid TCF v2 structure" };
  const now = Date.now(), created = decoded.createdMs;
  if (decoded.cmpId === 0) return { status: "suspicious", reason: "CMP ID is 0 — no registered consent platform issued it", decoded };
  if (created && (created > now + 864e5 || created < Date.UTC(2018, 0, 1))) return { status: "suspicious", reason: "its creation date is implausible", decoded };
  return { status: "valid", decoded };
}
