export type SocialProvider = 'google' | 'apple';

export interface SocialLoginRequest {
  provider: SocialProvider;
  id_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  user_id: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface AccessTokenResponse {
  access_token: string;
}

export interface RevokeRequest {
  refresh_token: string;
}

export interface ProductRef {
  image_url: string;
  caption: string;
  /** products.id (ai-server PR #98). Allows chat card -> PDP deep link. */
  product_id: number | null;
}

export interface ChatResponse {
  session_id: string;
  reply_text: string;
  products: ProductRef[];
}

export interface SessionSummary {
  session_id: string;
  title: string;
  last_message_at: string;
}

export type MessageRole = 'user' | 'assistant';

export interface MessageItem {
  message_id: string;
  role: MessageRole;
  content: string;
  product_refs: ProductRef[] | null;
  /** ai.searches.search_id — assistant turn 이 만든 result set 을 가리킴.
   * 재접속 시 [더보기] CTA 를 복원하는데 사용. */
  search_id?: string | null;
  created_at: string;
}

export interface MessageListResponse {
  messages: MessageItem[];
  next_cursor: string | null;
}

export interface ChatRequest {
  message: string;
  /** 'unisex' | 'women' | 'men' — sent as-is, server validates. */
  gender?: string | null;
  /** Upper price bound in KRW (원 단위). <=0 or null = no ceiling. */
  price_max?: number | null;
  /**
   * Final image_url from POST /v1/uploads — for image-anchored search.
   * Server-side ChatRequest schema is pending this field (P1 ask to 재관);
   * sending it now is a no-op until the server lands the field, then it
   * wires through with zero client change.
   */
  attached_image_url?: string | null;
}

/**
 * Server `clarify` SSE event — an inline-keyboard prompt (pick_item carousel,
 * gender ask, category pick, ...). The client renders `prompt` above the
 * `options` as tappable buttons; on tap POST /v1/chat/sessions/{sid}/callback
 * with the option's `callback` string.
 */
export interface ClarifyOption {
  label: string;
  callback: string;
}

export interface ClarifyPayload {
  axis: string;
  prompt: string;
  options: ClarifyOption[];
}

/** Body for POST /v1/chat/sessions/{sid}/callback — button tap. */
export interface ChatCallbackRequest {
  callback_data: string;
  /** Tapped button label — persisted as the user turn (mirrors what the user "said"). */
  label?: string | null;
}

export interface ApiErrorBody {
  detail: string;
}

export type UserGender = 'male' | 'female' | 'other';

export type UserTier = 'free' | 'basic' | 'pro' | 'premium';

export interface UserProfile {
  user_id: string;
  provider: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  gender: UserGender | null;
  tier: UserTier;
  tier_expires_at: string | null;
  created_at: string;
}

export interface UserPatchRequest {
  display_name?: string | null;
  gender?: UserGender | null;
}

export interface UserPatchResponse {
  user_id: string;
  display_name: string | null;
  gender: UserGender | null;
}

export interface DeleteMeRequest {
  confirm: boolean;
  reason?: string;
}

export interface SavedProduct {
  id: number;
  brand: string | null;
  name: string | null;
  price: number | null;
  image_url: string | null;
  in_stock: boolean | null;
}

export interface SaveItem {
  save_id: string;
  product_id: string;
  created_at: string;
}

export interface SaveListItem {
  save_id: string;
  product: SavedProduct | null;
  created_at: string;
}

export interface SaveListResponse {
  items: SaveListItem[];
  next_cursor: string | null;
  total: number;
}

export interface AddSaveRequest {
  product_id: string;
}

export interface BrandNode {
  id: number;
  brand_name: string;
  brand_name_normalized: string | null;
}

// ── 브랜드 팔로우 (POST/DELETE /v1/brands/{id}/follow, GET /v1/me/follows) ──
export interface FollowRequest {
  /** 팔로우 + 알림 여부. POST 재호출로 notify on/off 토글(스펙: PATCH 없이 통합). */
  notify: boolean;
}

export interface FollowResponse {
  following: boolean;
  notify_enabled: boolean;
}

export interface UnfollowResponse {
  following: boolean;
}

export interface FollowItem {
  brand_id: number;
  brand_name: string;
  notify_enabled: boolean;
}

export interface FollowListResponse {
  items: FollowItem[];
  next_cursor: string | null;
}

// ── 브랜드 홈 (GET /v1/brands/{id}, GET /v1/brands/{id}/products) ──
export interface BrandHome {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  product_count: number;
  following: boolean;
  notify_enabled: boolean;
  /** 공식몰 URL — 설명 시트의 '공식 스토어 방문' 링크 (brand_nodes.wiki.homepage_url). */
  store_url: string | null;
  /** 최근 소식 — admin 수동 관리 (brand_nodes.wiki.news). 단일 문자열. */
  news: string | null;
}

export interface BrandProduct {
  id: number;
  brand: string;
  name: string;
  price: number | null;
  original_price: number | null;
  sale_price: number | null;
  image_url: string;
  product_url: string;
}

export interface BrandProductsResponse {
  items: BrandProduct[];
  next_cursor: string | null;
}

/**
 * Lightweight reference returned in `ProductDetail.similar` — distinct from
 * the chat `ProductRef`. Server computes these via direct cosine distance
 * on `public.product_embeddings` (bypasses the v6 RPC), so the shape matches
 * the raw product row rather than chat-card metadata.
 */
export interface SimilarProduct {
  id: number;
  brand: string;
  name: string;
  price: number | null;
  /** Optional discount fields — present when the row has both. The PDP
   * card strikes through `original_price` and shows `sale_price` below. */
  original_price?: number | null;
  sale_price?: number | null;
  image_url: string;
  product_url: string;
}

export interface ProductDetail {
  id: number;
  brand: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  price: number | null;
  original_price: number | null;
  sale_price: number | null;
  image_url: string;
  images: string[] | null;
  product_url: string;
  in_stock: boolean;
  platform: string;
  gender: string[] | null;
  description: string | null;
  color: string | null;
  tags: string[] | null;
  brand_node: BrandNode | null;
  similar: SimilarProduct[];
}

export interface RecordViewRequest {
  // optional — 큐레이션 발 열람은 세션이 없다. 인기순 집계용 조회 신호는
  // 세션 유무와 무관하게 남겨야 하므로 서버가 session_id 없는 조회도 수용한다.
  session_id?: string;
  source_search_id?: string;
  dwell_ms?: number;
  /** 발화 문맥 — 서버 taste 신호 attribution 용 (curation/search/pdp 등). */
  source?: string;
  /** 큐레이션 구좌 ID (source=curation 일 때). */
  section_id?: string;
}

export interface RecordViewResponse {
  recorded: boolean;
  view_id: string | null;
}

/** POST /v1/products/{id}/outbound — 외부몰 이동(구매 클릭). popular 랭킹의
 *  outbound 신호(ai.taste_signal_events, signal_type='outbound')로 적재된다. */
export interface OutboundRequest {
  /** 발화 문맥 — 서버 Literal(curation/search/pdp/wishlist/history). */
  source?: 'curation' | 'search' | 'pdp' | 'wishlist' | 'history';
  section_id?: string;
}

export interface OutboundResponse {
  recorded: boolean;
}

export interface ViewedProduct {
  product_id: number;
  brand: string;
  name: string;
  price: number | null;
  image_url: string;
  product_url: string;
  viewed_at: string;
  source_search_id: string | null;
}

export interface ViewedListResponse {
  items: ViewedProduct[];
  next_cursor: string | null;
}

export interface LinkCheckResponse {
  alive: boolean;
  last_checked_at: string;
  http_status: number | null;
  alternative_url: string | null;
}

export type DevicePlatform = 'ios' | 'android';

export interface RegisterDeviceRequest {
  apns_token: string;
  platform?: DevicePlatform;
  app_version?: string;
  device_model?: string;
}

export interface RegisterDeviceResponse {
  device_id: string;
  registered_at: string;
}

export interface NotificationCategories {
  release_alerts?: boolean | null;
  taste_push?: boolean | null;
  system?: boolean | null;
  // v1.2 알림 카테고리 (재관 백엔드 추가) — 설정 화면 토글과 1:1.
  restock?: boolean | null;
  price_drop?: boolean | null;
  brand_new_product?: boolean | null;
  daily_briefing?: boolean | null;
}

// ── 알림함 (GET /v1/notifications, PATCH /v1/notifications/read) ──
export interface NotificationItem {
  id: string;
  /** 원본 DB kind — restock | price_drop | brand_new_product | brand_sale */
  type: string;
  text: string;
  sub: string;
  brand: string | null;
  product_id: number | null;
  brand_id: number | null;
  old_price: number | null;
  new_price: number | null;
  image_url: string | null;
  created_at: string;
  read: boolean;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  next_cursor: string | null;
  unread_count: number;
}

export interface MarkReadRequest {
  ids?: string[];
  all?: boolean;
}

export interface MarkReadResponse {
  unread_count: number;
  marked: number;
}

export interface UpdateNotificationsRequest {
  categories: NotificationCategories;
}

export interface UpdateNotificationsResponse {
  categories: NotificationCategories;
  updated_at: string;
}

export type FeedbackRating = 'positive' | 'negative';

export type FeedbackReasonKey =
  | 'mood_off'
  | 'fit'
  | 'color'
  | 'category_wrong'
  | 'too_expensive'
  | 'dead_link'
  | 'too_similar'
  | 'mood_match'
  | 'fit_color_good'
  | 'new_brand'
  | 'price_good'
  | 'discovery';

export interface FeedbackRequest {
  search_id?: string;
  rating: FeedbackRating;
  reasons: FeedbackReasonKey[];
  comment: string;
  consent?: boolean;
}

export interface FeedbackResponse {
  feedback_id: string;
  exported_to_training: boolean;
}

export type HistoryFeedType = 'all' | 'result_set' | 'product';

export interface HistoryResultSetItem {
  type: 'result_set';
  occurred_at: string;
  search_id: string;
  query_text: string;
  result_count: number;
  preview_images: string[];
}

export interface HistoryProductItem {
  type: 'product';
  occurred_at: string;
  product_id: number;
  brand: string | null;
  name: string | null;
  price: number | null;
  image_url: string;
  product_url: string | null;
  source_search_id: string | null;
}

export type HistoryItem = HistoryResultSetItem | HistoryProductItem;

export interface HistoryResponse {
  items: HistoryItem[];
  next_cursor: string | null;
}

/**
 * Server `ResultProduct` from `GET /v1/results/{search_id}`. Full grid page
 * for one search — ranked cosine order.
 */
export interface ResultProduct {
  rank: number;
  product_id: number;
  brand: string;
  name: string;
  price: number | null;
  image_url: string;
  product_url: string;
}

export interface ResultSetPageResponse {
  search_id: string;
  title: string | null;
  result_count: number;
  items: ResultProduct[];
  next_cursor: string | null;
}

// ── Onboarding & main curation (ai-server dev f94459b, 2026-07-15) ──────────

export type CurationGender = 'women' | 'men';

/** GET /v1/brands/search?q= — 온보딩 취향 스텝 고정 검색창 (no auth). */
export interface BrandSearchItem {
  id: number;
  name: string;
  node_id: number | null;
}

export interface BrandSearchResponse {
  brands: BrandSearchItem[];
}

/** POST /v1/onboarding — 로그인 완료 시 로컬 온보딩값 계정 승격 (auth).
 * picks 는 전체 교체(replace) — 서버가 brand_id 로 스타일 노드를 유도한다. */
export interface OnboardingRequest {
  gender: CurationGender;
  selected_brand_ids: number[];
}

export interface OnboardingResponse {
  user_id: string;
  gender: CurationGender;
  saved_brand_ids: number[];
}

/** GET /v1/curation 의 chips[] — 골든셋 유도 칩 (노출 label_ko, 실행 query_en). */
export interface CurationChip {
  id: string;
  pattern: string;
  label_ko: string;
  query_en: string;
  category: string;
}

export interface CurationProduct {
  product_id: number;
  brand: string;
  name: string;
  price: number | null;
  image_url: string;
  product_url: string;
}

export interface CurationSection {
  id: string;
  slot_type: 'auto' | 'editorial';
  title: string;
  subtitle: string | null;
  products: CurationProduct[];
}

/** GET /v1/curation?gender= — server-driven 메인 구좌. 구좌 개수·순서·타이틀
 * 전부 서버 결정. 로그인 유저는 프로필 gender 우선, 비로그인은 param 필수. */
export interface CurationResponse {
  gender: CurationGender;
  sections: CurationSection[];
  chips: CurationChip[];
}

/** POST /v1/curation/impressions 의 item — 서버가 product_id 로 style_node 를
 * 조회해 저장하므로 클라는 조인 키(section_id·product_id)와 position 만 보낸다.
 * position 은 서버에서 0–100 검증. (ai-server dev app/api/curation.py) */
export interface CurationImpressionItem {
  section_id: string;
  product_id: number;
  position?: number | null;
}

/** POST /v1/curation/impressions — 취향 신호(노출) 배치 기록. 인증 필수.
 * items 1–50개, 서버가 일별 dedupe. 개인화 taste score 의 입력 데이터. */
export interface CurationImpressionRequest {
  items: CurationImpressionItem[];
}

export interface CurationImpressionResponse {
  recorded: number;
}

export interface StyleNodeItem {
  id: number;
  code: string;
  name_en: string | null;
  keywords_en: string[];
}

export interface StyleNodesResponse {
  nodes: StyleNodeItem[];
  warmed: boolean;
}

export type LegalDocumentType = 'tos' | 'privacy';

export interface LegalVersionSet {
  tos: string;
  privacy: string;
}

export interface ConsentRecord {
  document_type: LegalDocumentType;
  version: string;
  consented_at: string;
}

export interface LegalVersionsResponse {
  current: LegalVersionSet;
  latest: LegalVersionSet;
  my_consents: ConsentRecord[];
}

export interface RecordConsentRequest {
  document_type: LegalDocumentType;
  version: string;
}

export interface RecordConsentResponse {
  consented_at: string;
}

export type SubscriptionStatus =
  | 'active'
  | 'grace'
  | 'expired'
  | 'revoked'
  | 'none';

export interface SubscriptionResponse {
  status: SubscriptionStatus;
  product_id: string | null;
  expires_at: string | null;
  auto_renew: boolean | null;
  will_renew_at: string | null;
  manage_url: string;
}

export type UploadContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface CreateUploadRequest {
  filename: string;
  content_type: UploadContentType | string;
  size_bytes: number;
}

export interface CreateUploadResponse {
  upload_id: string;
  /** Short-lived presigned S3 PUT URL — client uploads bytes here. */
  upload_url: string;
  /** Final public (CloudFront) image URL — pass this to chat / search. */
  image_url: string;
  expires_at: string;
  max_size_bytes: number;
}

/** GET /v1/app/config — 모바일 버전 게이트 설정 (무인증). */
export interface AppPlatformConfig {
  /** 이 미만은 강제 업데이트(차단 모달). */
  min_version: string;
  /** 이 미만은 권장 업데이트(닫기 가능 모달). */
  latest_version: string;
  /** App Store 딥링크 (itms-apps://). */
  store_url: string;
}

export interface AppConfig {
  ios: AppPlatformConfig;
}
