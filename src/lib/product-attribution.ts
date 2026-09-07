export const PRODUCT_SOURCES = [
  'search',
  'curation',
  'wishlist',
  'history',
  'pdp',
] as const;

export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export type OutboundAttributionInput = {
  sessionId?: string | null;
  searchId?: string | null;
  source?: string | null;
  sectionId?: string | null;
};

export type OutboundAttribution = {
  source: ProductSource;
  session_id: string | null;
  thread_id: string | null;
  section_id: string | null;
};

export type OutboundClickInput = OutboundAttributionInput & {
  productId: string;
  alternativeUsed: boolean;
};

export type OutboundClickProperties = OutboundAttribution & {
  product_id: string;
  alternative_used: boolean;
};

function nonEmpty(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeProductSource(
  source: string | null | undefined,
  searchId?: string | null,
): ProductSource {
  const normalized = nonEmpty(source);
  if (
    normalized &&
    (PRODUCT_SOURCES as readonly string[]).includes(normalized)
  ) {
    return normalized as ProductSource;
  }
  return nonEmpty(searchId) ? 'search' : 'pdp';
}

export function resolveOutboundAttribution(
  input: OutboundAttributionInput,
  cachedSessionId?: string | null,
): OutboundAttribution {
  const sessionId = nonEmpty(input.sessionId) ?? nonEmpty(cachedSessionId);
  return {
    source: normalizeProductSource(input.source, input.searchId),
    session_id: sessionId,
    thread_id: sessionId,
    section_id: nonEmpty(input.sectionId),
  };
}

export function buildOutboundClickProperties(
  input: OutboundClickInput,
  cachedSessionId?: string | null,
): OutboundClickProperties {
  return {
    product_id: input.productId,
    alternative_used: input.alternativeUsed,
    ...resolveOutboundAttribution(input, cachedSessionId),
  };
}
