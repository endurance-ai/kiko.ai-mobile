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
  session_id: string;
  source_search_id?: string;
  dwell_ms?: number;
}

export interface RecordViewResponse {
  recorded: boolean;
  view_id: string | null;
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
