/**
 * "최윤영" → "윤영", "윤영 최" → "최", "John Smith" → "Smith".
 * Pure-Hangul names without spaces drop the first character (single-syllable
 * Korean surnames cover ~99% of the population). Names with whitespace drop
 * the first space-delimited token. Anything else passes through.
 */
export function stripFamilyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(' ')) {
    const rest = trimmed.split(/\s+/).slice(1).join(' ').trim();
    return rest || trimmed;
  }
  // Pure-Hangul block: U+AC00 ~ U+D7A3 only.
  if (/^[가-힣]+$/.test(trimmed) && trimmed.length >= 2) {
    return trimmed.slice(1);
  }
  return trimmed;
}
