# DevJournal

A mobile-first RSS reader for developers, built with Expo / React Native. DevJournal discovers dev feeds, ranks articles by relevance, and keeps your reading list clean with on-device NSFW/content moderation and smart ranking.

![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-4630EB.svg)
![Expo](https://img.shields.io/badge/expo-54.0.35-000020.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

- **Feed discovery** — find and subscribe to developer RSS feeds (`services/feedDiscovery.ts`)
- **Smart ranking** — articles scored and ordered by relevance (`services/ranking.ts`)
- **On-device NSFW & content moderation** — TensorFlow.js powered detection, no data leaves the device (`services/nsfwDetector.ts`, `services/contentModeration.ts`)
- **RSS parsing** — fast parsing with Cheerio (`services/rssParser.ts`)
- **Local storage** — offline-first SQLite database (`services/db.ts`)
- **Saved articles** — bookmark and revisit what matters (`app/(tabs)/saved.tsx`)
- **Background updates** — periodic foreground polling for fresh content (`services/backgroundFetch.ts`)
- **Notifications** — digests and alerts via `expo-notifications`
- **Light & dark themes** — smooth adaptive UI

## Screenshots

> _Add screenshots or a demo GIF of the app here._

## Tech Stack

- [Expo](https://expo.dev/) 54 + [React Native](https://reactnative.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation
- [TensorFlow.js](https://www.tensorflow.org/js) for on-device ML
- [SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) via `expo-sqlite`
- [@shopify/flash-list](https://shopify.github.io/flash-list/) for performant lists
- Cheerio for HTML/RSS parsing

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- A physical device or emulator (iOS Simulator / Android Emulator) — or use Expo Go

## Installation

```bash
# Clone the repository
git clone https://github.com/Meinsomniac/distill.git
cd distill

# Install dependencies
npm install
# or
yarn install
```

## Usage

```bash
# Start the Expo dev server
npm run dev

# Run on a specific platform
npm run android
npm run ios

# Build the web bundle
npm run build:web
```

Then open the Expo Go app on your phone and scan the QR code, or launch the iOS/Android simulator.

## Project Structure

```
app/            Expo Router screens (tabs: home, feeds, saved, settings)
components/      Reusable UI components
services/        Data layer: RSS, ranking, ML moderation, DB, notifications
constants/       App constants (keywords, config)
context/         React context providers
hooks/           Custom React hooks
types/           TypeScript type definitions
utils/           Helper utilities
docs/            Project documentation
```

## Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the Expo dev server            |
| `npm run android`   | Run on Android                       |
| `npm run ios`       | Run on iOS                           |
| `npm run build:web` | Export the web build                 |
| `npm run lint`      | Run ESLint                           |
| `npm run typecheck` | Run TypeScript type checking         |

## Roadmap

See [ROADMAP-v2.md](./ROADMAP-v2.md) for planned features, including:

- Font size & daily/weekly digest preferences
- Swipe-to-delete on saved articles
- OS-level background fetch
- Standalone feed discovery backend
- Article categorization & filtering

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add my feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Please run `npm run lint` and `npm run typecheck` before submitting.

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- Built with [Expo](https://expo.dev/) and the React Native community
- On-device ML powered by [TensorFlow.js](https://www.tensorflow.org/js)
