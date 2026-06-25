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
