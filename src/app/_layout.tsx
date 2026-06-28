import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useRegisterDevice } from '@/hooks/use-register-device';
import { AuthProvider } from '@/state/auth';
import { BannerProvider } from '@/state/banner';
import { FeedbackProvider } from '@/state/feedback';
import { FilterProvider } from '@/state/filter';
import { SubscriptionProvider } from '@/state/subscription';
import { WishlistProvider } from '@/state/wishlist';

function AuthSideEffects({ children }: { children: ReactNode }) {
  useRegisterDevice();
  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AuthSideEffects>
            <BannerProvider>
              <FilterProvider>
                <WishlistProvider>
                  <SubscriptionProvider>
                    <FeedbackProvider>
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="login" options={{ animation: 'fade' }}
  />
                        <Stack.Screen name="home" />
                        <Stack.Screen name="history" />
                        <Stack.Screen name="list" />
                        <Stack.Screen name="wishlist" />
                        <Stack.Screen name="product/[id]" />
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
                    </FeedbackProvider>
                  </SubscriptionProvider>
                </WishlistProvider>
              </FilterProvider>
            </BannerProvider>
          </AuthSideEffects>
        </AuthProvider>
      </ThemeProvider>
    );
  }