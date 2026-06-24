import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Toaster } from 'sonner-native';
import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AppProvider, useApp } from '@/context/AppContext';
import { seedCustomFeedsIfNeeded } from '@/services/db';
import { requestNotificationPermissions, setupNotificationResponseHandler } from '@/services/notifications';

function ThemedLayout() {
  useFrameworkReady();
  const { isDark, colors } = useApp();
  const toastBg = isDark ? colors.bgTertiary : colors.bgPrimary;
  const router = useRouter();

  useEffect(() => {
    seedCustomFeedsIfNeeded();
    requestNotificationPermissions();
    const subscription = setupNotificationResponseHandler(
      (articleId) => router.push(`/article/${articleId}`)
    );
    return () => subscription.remove();
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
      <Toaster
        position='bottom-center'
        theme={isDark ? 'dark' : 'light'}
        duration={2000}
        swipeToDismissDirection='left'
        icons={{ loading: <ActivityIndicator color={colors.textSecondary} /> }}
        toastOptions={{
          style: { backgroundColor: toastBg },
          titleStyle: { color: colors.textPrimary },
          descriptionStyle: { color: colors.textSecondary },
        }}
      />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size='large' color='#666' />
      </View>
    );
  }

  return (
    <AppProvider>
      <ThemedLayout />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0e0e11',
  },
});
