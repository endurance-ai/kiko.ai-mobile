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
