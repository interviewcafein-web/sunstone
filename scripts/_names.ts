// Tidying the LMS's hand-typed subject names.

/** "PRIME_COMMUNICATION", "Prime_aptitude " → "Prime Communication", "Prime Aptitude". */
export function subjectName(raw: string): string {
  const name = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name;
  return name.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}
