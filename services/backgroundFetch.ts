import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { fetchAllFeeds } from './rssParser';
import { saveArticles, pruneOldArticles, getNotifiedArticleIds, markArticlesNotified } from './db';
import { deduplicateByLink } from './ranking';
import { sendBreakingNotificationBatch } from './notifications';

const BACKGROUND_FETCH_TASK = 'devjournal-background-fetch';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  console.log('[BackgroundFetch] Task started');

  try {
    const articles = await fetchAllFeeds(true);
    if (articles.length === 0) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const unique = deduplicateByLink(articles);
    const savedCount = await saveArticles(unique);
    const prunedCount = await pruneOldArticles();

    console.log(`[BackgroundFetch] Saved ${savedCount}, pruned ${prunedCount}`);

    const notifiedIds = await getNotifiedArticleIds();
    const breaking = unique.filter(
      (a) => a.importance_score === 5 && !notifiedIds.has(a.id)
    );

    if (breaking.length > 0) {
      await sendBreakingNotificationBatch(
        breaking.map((a) => ({ title: a.title, sourceName: a.source_name, id: a.id }))
      );
      await markArticlesNotified(breaking.map((a) => a.id));
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[BackgroundFetch] Task failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundFetch(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
  if (isRegistered) {
    console.log('[BackgroundFetch] Already registered');
    return;
  }

  try {
    await BackgroundTask.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 60,
    });
    console.log('[BackgroundFetch] Registered successfully');
  } catch (error) {
    console.error('[BackgroundFetch] Registration failed:', error);
  }
}

export async function unregisterBackgroundFetch(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    console.log('[BackgroundFetch] Unregistered');
  } catch (error) {
    console.error('[BackgroundFetch] Unregistration failed:', error);
  }
}

export function isBackgroundFetchRegistered(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
}
