/**
 * Product type — backend `SearchResult.Candidate` (app/domain/search.py) 의
 * 모바일 측 mirror. 실제 v6 검색 결과 도착 전까지 MOCK_PRODUCTS 로 UI 검증.
 */
export type Product = {
  id: string;
  brand: string;
  name: string;
  priceWon: number;
  /** Solid hex placeholder until real image URL is available from backend. */
  colorHint: string;
  imageUri?: string;
};

export const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', brand: 'noon', name: '코튼 오버셔츠', priceWon: 48000, colorHint: '#B8A285' },
  { id: 'p2', brand: 'depound', name: '루즈핏 셔츠', priceWon: 39000, colorHint: '#D4C9AC' },
  { id: 'p3', brand: 'slowand', name: '린넨 블렌드', priceWon: 61000, colorHint: '#D5AFB5' },
  { id: 'p4', brand: 'another', name: '워시드 셔츠', priceWon: 52000, colorHint: '#9FA5B0' },
  { id: 'p5', brand: 'muzii', name: '소프트 셔츠', priceWon: 44000, colorHint: '#B5A5C5' },
  { id: 'p6', brand: 'COS', name: '오버사이즈 셔츠', priceWon: 119000, colorHint: '#E8DCC4' },
  { id: 'p7', brand: 'Lemaire', name: '실크 블렌드 셔츠', priceWon: 198000, colorHint: '#CFB99B' },
  { id: 'p8', brand: 'Toteme', name: '오가닉 코튼 셔츠', priceWon: 176000, colorHint: '#C6B59A' },
  { id: 'p9', brand: 'AGOLDE', name: '와이드 데님', priceWon: 228800, colorHint: '#9CA8B8' },
  { id: 'p10', brand: 'Stüssy', name: '루즈핏 티', priceWon: 76000, colorHint: '#B7B0A2' },
  { id: 'p11', brand: 'matin kim', name: '크롭 자켓', priceWon: 89000, colorHint: '#E0C5BB' },
  { id: 'p12', brand: 'OPENING', name: '플리츠 스커트', priceWon: 67000, colorHint: '#C9B8C8' },
];

export function formatPrice(won: number): string {
  return `₩${won.toLocaleString('ko-KR')}`;
}

/** Lookup that gracefully handles synthetic ids (cur-3 / past-1 / etc.). */
export function findProduct(id: string | undefined): Product {
  if (!id) return MOCK_PRODUCTS[0];
  const exact = MOCK_PRODUCTS.find((p) => p.id === id);
  if (exact) return exact;
  const m = id.match(/(\d+)/);
  const num = m ? parseInt(m[1], 10) : 0;
  return MOCK_PRODUCTS[num % MOCK_PRODUCTS.length];
}
