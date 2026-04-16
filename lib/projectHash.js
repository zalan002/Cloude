// Shared hash utilities for generating stable minicrm_id values.
// Used by both project sync and manual project creation.

// FNV-1a based hash that fits within PostgreSQL INT4 range
export function hashString(str) {
  const s = str.trim().toLowerCase();
  let h1 = 0x811c9dc5; // FNV offset basis
  let h2 = 0x12345678;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193); // FNV prime
    h2 ^= c * (i + 1);
    h2 = Math.imul(h2, 0x5bd1e995);
  }
  // Combine and keep within safe INT4 range (1,000,000 to 2,147,483,647)
  const combined = Math.abs((h1 ^ h2) | 0);
  return (combined % 2146483647) + 1000000;
}

// Convert a source_id (numeric or alphanumeric) to a stable numeric minicrm_id
export function toMiniCrmId(sourceId, name) {
  if (sourceId) {
    const parsed = parseInt(sourceId);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    // Alphanumeric ID: hash it
    return hashString(sourceId);
  }
  return hashString(name);
}
