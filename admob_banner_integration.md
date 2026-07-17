# Implementing AdMob Banner Ads (One After Every 8 Articles)

This guide shows how to integrate Google AdMob into a React Native app to display a banner ad
after every 8 articles in a news feed list.

## Prerequisites

- React Native project (0.70+ recommended)
- `@react-native-google-mobile-ads` installed
- An AdMob account and app registered in the AdMob console

## 1. Install the package

```bash
npm install @react-native-google-mobile-ads
# or
yarn add @react-native-google-mobile-ads
```

Then install pods (iOS):

```bash
cd ios && pod install && cd ..
```

## 2. Configure the AdMob App ID

### Android — `android/app/src/main/AndroidManifest.xml`

Add the `meta-data` tag inside the `<application>` block:

```xml
<manifest>
  <application>
    <meta-data
      android:name="com.google.android.gms.ads.APPLICATION_ID"
      android:value="ca-app-pub-7106899968085818~5951781354"/>
  </application>
</manifest>
```

### iOS — `ios/YourApp/Info.plist`

Add the `GADApplicationIdentifier` key:

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-7106899968085818~5951781354</string>
```

## 3. Initialize AdMob

Call `initialize` early (e.g., in `App.tsx`):

```ts
import mobileAds from '@react-native-google-mobile-ads';

mobileAds()
  .initialize()
  .then(() => {
    // AdMob is ready
  });
```

## 4. Add test device (during development)

To avoid invalid traffic while testing, add your test device ID. The banner test ad unit
below is Google's standard test ID and is safe to use in development.

```ts
import { TestIds, BannerAdSize } from '@react-native-google-mobile-ads';

// Use the test banner ID while developing:
const BANNER_AD_UNIT_ID = __DEV__
  ? 'ca-app-pub-3940256099942544/9214589741' // Google test banner
  : 'ca-app-pub-XXXXXXXXX/YYYYYYYYYY';        // your real production banner ID
```

> Note: `ca-app-pub-3940256099942544/9214589741` is Google's official test banner ad unit.
> It always returns a test ad and will never generate real revenue, so it is safe to ship
> behind a `__DEV__` check.

## 5. Create a reusable Banner component

```tsx
// components/ArticleBanner.tsx
import React from 'react';
import { BannerAd, BannerAdSize } from '@react-native-google-mobile-ads';
import { View, StyleSheet } from 'react-native';

const BANNER_AD_UNIT_ID = __DEV__
  ? 'ca-app-pub-3940256099942544/9214589741'
  : 'ca-app-pub-XXXXXXXXX/YYYYYYYYYY';

export default function ArticleBanner() {
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.BANNER}
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
    marginVertical: 8,
  },
});
```

## 6. Render one banner after every 8 articles

Interleave the banner into the flat list data so a banner appears after article 8, 16, 24, etc.

```tsx
// screens/NewsFeed.tsx
import React from 'react';
import { FlatList, ListRenderItem } from 'react-native';
import ArticleBanner from '../components/ArticleBanner';

const ARTICLES_PER_AD = 8;

type Item = { type: 'article'; data: Article } | { type: 'ad' };

function buildFeed(articles: Article[]): Item[] {
  const feed: Item[] = [];
  articles.forEach((article, index) => {
    feed.push({ type: 'article', data: article });
    // Insert an ad after every 8 articles (not at the very end)
    if ((index + 1) % ARTICLES_PER_AD === 0 && index + 1 !== articles.length) {
      feed.push({ type: 'ad' });
    }
  });
  return feed;
}

const renderItem: ListRenderItem<Item> = ({ item }) => {
  if (item.type === 'ad') {
    return <ArticleBanner />;
  }
  return <ArticleCard article={item.data} />;
};

export default function NewsFeed({ articles }: { articles: Article[] }) {
  const data = buildFeed(articles);
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={(item, index) =>
        item.type === 'ad' ? `ad-${index}` : item.data.id
      }
    />
  );
}
```

### How it works

- `buildFeed` walks the article list and pushes an `{ type: 'ad' }` marker after every
  8th article.
- The marker is skipped at the very last article so no ad appears at the bottom edge.
- `FlatList` renders `ArticleBanner` wherever an ad marker exists.

## 7. Production checklist

- [ ] Replace the production banner ID placeholder with your real ad unit ID.
- [ ] Confirm `GADApplicationIdentifier` / `com.google.android.gms.ads.APPLICATION_ID` match
      your AdMob app ID `ca-app-pub-7106899968085818~5951781354`.
- [ ] Remove or gate test device IDs before release.
- [ ] Test on a real device (emulators may not render ads reliably).
- [ ] Respect ad policies: do not place banners over content or reload them too frequently.
- [ ] Apply Shariah-compliant content filters (see section 8).

## 8. Shariah-compliant ad filtering

You cannot hand-pick individual advertisers in AdMob (it is an automated auction network),
but you can strongly filter out non-compliant categories. Apply these settings in the
**AdMob console** (apps.admob.com) for this app before going live.

### AdMob console steps

1. Open **Apps → [your app] → Brand safety → Content filters**.
2. Under **Sensitive categories**, toggle OFF / block:
   - **Dating**
   - **Alcohol**
   - **Gambling / Casino** (Games of chance)
   - **Prescription drugs / Pharmaceuticals**
   - **Politics**
3. Under **General categories**, block any additional categories that conflict with
   Islamic finance principles (e.g., high-risk financial products, conventional
   insurance, interest-based lending).
4. Set the **maximum ad content rating** to **"General" (G)** or **"T" (Teen)** to avoid
   mature or suggestive content.
5. Use **banners only** in this app (avoid interstitial / rewarded video), since
   full-screen media carries a higher risk of inappropriate content.
6. Open the **Ad review center** periodically and **block specific advertisers / domains**
   that slip through (e.g., an alcohol brand misclassified under a general category).

### What you can and cannot control

| Can control                                  | Cannot control                              |
|----------------------------------------------|---------------------------------------------|
| Block sensitive + general categories         | Pre-approve every individual advertiser     |
| Set max ad content rating                    | Guarantee 100% compliance (occasional slip)|
| Block specific advertisers after review      | Auction-based network picks the winning bid |
| Choose ad format (banner only)               | Direct-sold vetted advertisers via AdMob   |

### For higher assurance

- For full control over advertisers, use **direct-sold / house ads** (your own vetted
  Muslim-friendly advertisers) instead of the AdMob network — but this requires finding
  advertisers yourself and yields smaller inventory.
- Consider a **Muslim-focused / regional halal ad network** alongside AdMob for more
  aligned inventory (usually lower earnings).
- Because banner filtering is network-wide and automated, schedule a recurring manual
  review of the Ad review center to maintain compliance over time.

## Reference IDs used



| Purpose            | ID                                      |
|--------------------|-----------------------------------------|
| AdMob App ID       | `ca-app-pub-7106899968085818~5951781354` |
| Test Banner Ad Unit| `ca-app-pub-3940256099942544/9214589741` |
