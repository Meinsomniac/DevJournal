import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useTheme } from '@/hooks/useTheme';
import { Spacing } from '@/constants/Spacing';
const isDev = __DEV__

// Google's official test banner ad unit — always returns a test ad and never
// earns real revenue, so it is safe to use while developing. Swap for your
// real production banner ad unit ID behind a __DEV__ check before release.
const BANNER_AD_UNIT_ID = isDev
  ? 'ca-app-pub-3940256099942544/9214589741'
  : 'ca-app-pub-7106899968085818/3353538171';

const INTERSTITIAL_AD_UNIT_ID = isDev
  ? 'ca-app-pub-3940256099942544/1033173712'
  : 'ca-app-pub-7106899968085818/7868282074';

export { INTERSTITIAL_AD_UNIT_ID };

export default function AdBanner({size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER}: {size?: BannerAdSize}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bgPrimary, borderWidth: 0 },
      ]}
    >
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
