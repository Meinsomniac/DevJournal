import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native/dist/platform_react_native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native/dist/bundle_resource_io';
import { decodeJpeg } from '@tensorflow/tfjs-react-native/dist/decode_image';

// ── CONFIG ──
const CLASS_NAMES = ['Drawing', 'Hentai', 'Neutral', 'Porn', 'Sexy'] as const;

const THRESHOLDS: Record<string, number> = {
  Porn: 0.05,
  Hentai: 0.05,
  Sexy: 0.2,
};

let model: tf.GraphModel | null = null;
let initializing: Promise<void> | null = null;

// ── PUBLIC API ──
export function isNSFWReady(): boolean {
  return model !== null;
}

export async function initNSFWModel(): Promise<void> {
  if (model || initializing) return;

  initializing = (async () => {
    try {
      await tf.ready();
      console.log('[NSFW] TF backend ready:', tf.getBackend());

      const modelJson = require('../assets/models/nsfw/model.json');
      const modelWeights = [
        require('../assets/models/nsfw/group1-shard1of2.bin'),
        require('../assets/models/nsfw/group1-shard2of2.bin'),
      ];

      const ioHandler = bundleResourceIO(modelJson, modelWeights);
      model = await tf.loadGraphModel(ioHandler);
      console.log('[NSFW] Model loaded successfully');
    } catch (error) {
      console.error('[NSFW] Model init failed:', error);
      model = null;
    }
  })();

  await initializing;
  initializing = null;
}

export interface ClassificationResult {
  isNSFW: boolean;
  scores: Record<string, number>;
}

export async function classifyImage(
  imageUrl: string,
  articleTitle?: string,
): Promise<ClassificationResult | null> {
  if (!model) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const imgBytes = new Uint8Array(arrayBuffer);

    const probabilities = tf.tidy(() => {
      const imageTensor = decodeJpeg(imgBytes, 3);
      const resized = tf.image.resizeBilinear(imageTensor, [224, 224]);
      const expanded = resized.expandDims(0);
      const normalized = expanded.toFloat().div(127.5).sub(1);
      const output = model!.predict(normalized) as tf.Tensor;
      return output.dataSync();
    });

    const scores: Record<string, number> = {};
    for (let i = 0; i < CLASS_NAMES.length; i++) {
      scores[CLASS_NAMES[i]] = probabilities[i];
    }

    console.log({ articleTitle, scores });

    const isNSFW =
      scores.Porn >= THRESHOLDS.Porn ||
      scores.Hentai >= THRESHOLDS.Hentai ||
      scores.Sexy >= THRESHOLDS.Sexy;

    return { isNSFW, scores };
  } catch (error) {
    console.warn('[NSFW] classifyImage failed:', error);
    return null;
  }
}
