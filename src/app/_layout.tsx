import { Image as ExpoImage } from 'expo-image';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ReactNode, useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AppUpdateGate } from '@/components/app-update-gate';
import { useRegisterDevice } from '@/hooks/use-register-device';
import { useShareIntent } from '@/hooks/use-share-intent';
import { initAnalytics } from '@/lib/analytics';
import { AuthProvider } from '@/state/auth';
import { BannerProvider } from '@/state/banner';
import { CapProvider } from '@/state/cap';
import { FeedbackProvider } from '@/state/feedback';
import { FilterProvider } from '@/state/filter';
import { SubscriptionProvider } from '@/state/subscription';
import { WishlistProvider } from '@/state/wishlist';

// Brand assets used across screens (sidebar wordmark, etc). Preloading at
// app start warms expo-image's native memory cache so the first render on
// each surface is instant instead of decode-on-mount.
const PRELOAD_ASSETS = [require('../../assets/brand/kiko-wordmark.png')];

function AuthSideEffects({ children }: { children: ReactNode }) {
  useRegisterDevice();
  useShareIntent();
  useEffect(() => {
    void initAnalytics();
    void ExpoImage.prefetch(PRELOAD_ASSETS, 'memory-disk');
  }, []);
  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AuthSideEffects>
            <BannerProvider>
              <CapProvider>
              <FilterProvider>
                <WishlistProvider>
                  <SubscriptionProvider>
                    <FeedbackProvider>
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen
                          name="login"
                          options={{
                            presentation: 'formSheet',
                            sheetAllowedDetents: [0.92],
                            sheetGrabberVisible: true,
                            sheetCornerRadius: 28,
                            gestureEnabled: true,
                            animation: 'slide_from_bottom',
                          }}
                        />
                        {/* home 은 가로 슬라이드 대신 fade — splash→home
                            replace 전환이 가로로 움직이면 최초 랜딩 오토키보드
                            focus 가 그 전환에 물려 키보드가 옆에서 슬라이드하고
                            회색 프레임이 먼저 뜬다. 가로 모션을 없애 정상적으로
                            아래에서 올라오게 한다. */}
                        <Stack.Screen
                          name="home"
                          options={{ animation: 'fade' }}
                        />
                        <Stack.Screen name="list" />
                        <Stack.Screen name="wishlist" />
                        <Stack.Screen name="product/[id]" />
                        <Stack.Screen name="curation/[id]" />
                        <Stack.Screen name="chat/[id]" />
                        <Stack.Screen
                          name="filter"
                          options={{
                            presentation: 'formSheet',
                            sheetAllowedDetents: [0.5],
                            sheetGrabberVisible: true,
                            sheetCornerRadius: 28,
                            gestureEnabled: true,
                            animation: 'slide_from_bottom',
                          }}
                        />
                        <Stack.Screen
                          name="sidebar"
                          options={{
                            presentation: 'transparentModal',
                            animation: 'none',
                            gestureEnabled: false,
                            contentStyle: { backgroundColor: 'transparent' },
                          }}
                        />
                        <Stack.Screen name="settings" />
                        <Stack.Screen name="notifications-inbox" />
                        <Stack.Screen name="notification-settings" />
                        <Stack.Screen
                          name="feedback"
                          options={{
                            presentation: 'formSheet',
                            sheetAllowedDetents: [0.6, 0.95],
                            sheetGrabberVisible: true,
                            sheetCornerRadius: 28,
                            gestureEnabled: true,
                            animation: 'slide_from_bottom',
                          }}
                        />
                      </Stack>
                      <AppUpdateGate />
                    </FeedbackProvider>
                  </SubscriptionProvider>
                </WishlistProvider>
              </FilterProvider>
              </CapProvider>
            </BannerProvider>
          </AuthSideEffects>
        </AuthProvider>
      </ThemeProvider>
    );
  }