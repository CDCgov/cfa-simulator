/**
 * Whether `file` matches a native `accept` list (`.csv,text/csv,image/*`).
 * The dialog filters its own picks; this is for files dropped on the field.
 * An empty or missing `accept` matches everything.
 */
export function acceptsFile(file: File, accept: string | undefined): boolean {
  const patterns = (accept ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (patterns.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  for (const pattern of patterns) {
    if (pattern.startsWith(".")) {
      if (name.endsWith(pattern)) return true;
    } else if (pattern.endsWith("/*")) {
      if (type.startsWith(pattern.slice(0, -1))) return true;
    } else if (type === pattern) {
      return true;
    }
  }
  return false;
}
