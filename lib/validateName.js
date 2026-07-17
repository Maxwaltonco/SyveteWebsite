// Shared between the Apply modal (client) and /api/apply (server) so the
// rule can't drift or be bypassed by skipping the UI.
//
// Requires at least two words, each at least 2 letters, each made up of
// actual letters (hyphens/apostrophes allowed for names like "O'Brien" or
// "Smith-Jones") — rejects single words, digits, and single/double-letter junk.
const NAME_PART_RE = /^[A-Za-z]+(?:['-][A-Za-z]+)*$/;

export function isValidFullName(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every((p) => p.length >= 2 && NAME_PART_RE.test(p));
}

export const FULL_NAME_ERROR = "Enter a full first and last name";
