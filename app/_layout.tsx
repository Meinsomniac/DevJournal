import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AppProvider, useApp } from '@/context/AppContext';
import { requestNotificationPermissions, setupNotificationResponseHandler } from '@/services/notifications';

function ThemedLayout() {
  useFrameworkReady();
  const { isDark, colors } = useApp();
  const router = useRouter();

  useEffect(() => {
    requestNotificationPermissions();
    const subscription = setupNotificationResponseHandler(
      (articleId) => router.push(`/article/${articleId}`)
    );
    return () => subscription.remove();
  }, [router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="article/[id]"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            headerTintColor: colors.textPrimary,
            headerStyle: {
              backgroundColor: colors.bgPrimary,
            },
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <ThemedLayout />
    </AppProvider>
  );
}
