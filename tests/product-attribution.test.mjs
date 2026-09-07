import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOutboundClickProperties,
  normalizeProductSource,
  resolveOutboundAttribution,
} from '../src/lib/product-attribution.ts';

test('preserves every supported product source', () => {
  for (const source of ['search', 'curation', 'wishlist', 'history', 'pdp']) {
    assert.equal(normalizeProductSource(source), source);
  }
});

test('infers search from search_id when source is missing or invalid', () => {
  assert.equal(normalizeProductSource(undefined, 'search-1'), 'search');
  assert.equal(normalizeProductSource('not-a-source', 'search-1'), 'search');
});

test('falls back to pdp instead of forwarding an invalid source', () => {
  assert.equal(normalizeProductSource(undefined), 'pdp');
  assert.equal(normalizeProductSource('550e8400-e29b-41d4-a716-446655440000'), 'pdp');
});

test('uses the route session for both session_id and thread_id', () => {
  assert.deepEqual(
    resolveOutboundAttribution(
      { sessionId: 'route-session', source: 'search' },
      'cached-session',
    ),
    {
      source: 'search',
      session_id: 'route-session',
      thread_id: 'route-session',
      section_id: null,
    },
  );
});

test('falls back to the cached session and keeps curation section_id', () => {
  assert.deepEqual(
    resolveOutboundAttribution(
      { source: 'curation', sectionId: 'editorial-summer' },
      'cached-session',
    ),
    {
      source: 'curation',
      session_id: 'cached-session',
      thread_id: 'cached-session',
      section_id: 'editorial-summer',
    },
  );
});

test('keeps thread_id null when no real session exists', () => {
  const attribution = resolveOutboundAttribution({ source: 'wishlist' });
  assert.equal(attribution.session_id, null);
  assert.equal(attribution.thread_id, null);
});

test('builds the complete outbound_click property contract', () => {
  assert.deepEqual(
    buildOutboundClickProperties({
      productId: '42',
      alternativeUsed: true,
      sessionId: 'thread-42',
      searchId: 'search-42',
      source: 'search',
    }),
    {
      product_id: '42',
      alternative_used: true,
      source: 'search',
      session_id: 'thread-42',
      thread_id: 'thread-42',
      section_id: null,
    },
  );
});
