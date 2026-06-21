let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch {
  console.log('[Notifications] Not available in this environment');
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function sendBreakingNotificationBatch(
  articles: Array<{ title: string; sourceName: string; id: string }>
): Promise<void> {
  if (!Notifications || articles.length === 0) return;

  const primary = articles[0];
  const count = articles.length;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Important News',
      subtitle: count > 1 ? `${count} important stories` : primary.sourceName,
      body: count > 1 ? `${primary.title} and ${count - 1} more` : primary.title,
      data: { articleId: primary.id },
    },
    trigger: null,
  });
}

export function setupNotificationResponseHandler(
  onNavigate: (articleId: string) => void
): { remove: () => void } {
  if (!Notifications) return { remove: () => {} };
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response: any) => {
      const articleId = response.notification.request.content.data?.articleId as string | undefined;
      if (articleId) onNavigate(articleId);
    }
  );
  return subscription;
}
