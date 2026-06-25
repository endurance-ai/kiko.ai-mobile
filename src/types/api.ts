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
