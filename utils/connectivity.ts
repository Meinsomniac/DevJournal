import { getNetworkStateAsync } from 'expo-network';

export class NoInternetError extends Error {
  constructor() {
    super('No internet connection');
    this.name = 'NoInternetError';
  }
}

export async function checkConnectivity(): Promise<void> {
  try {
    const state = await getNetworkStateAsync();
    if (!state.isConnected || state.isInternetReachable === false) {
      throw new NoInternetError();
    }
  } catch (error) {
    if (error instanceof NoInternetError) throw error;
    // If expo-network itself fails, let the fetch attempt go through
    console.warn('[Connectivity] Failed to check network state:', error);
  }
}
