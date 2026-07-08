import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native/dist/platform_react_native';
import { decodeJpeg } from '@tensorflow/tfjs-react-native/dist/decode_image';
import * as ImageManipulator from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';

const MODEL_URL =
  'https://cdn.jsdelivr.net/gh/infinitered/nsfwjs@v4.3.0/models/mobilenet_v2_mid/model.json';

const CLASS_NAMES = ['Drawing', 'Hentai', 'Neutral', 'Porn', 'Sexy'] as const;

const THRESHOLDS: Record<string, number> = {
  Porn: 0.05,
  Hentai: 0.05,
  Sexy: 0.2,
};

let model: tf.GraphModel | null = null;
let initializing: Promise<void> | null = null;

export function isNSFWReady(): boolean {
  return model !== null;
}

export async function initNSFWModel(): Promise<void> {
  if (model || initializing) return;

  initializing = (async () => {
    try {
      await tf.ready();
      model = await tf.loadGraphModel(MODEL_URL);
      console.log('[NSFW] Model loaded');
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
  articleTitle?: string
): Promise<ClassificationResult | null> {
  if (!model) return null;

  let tempFile: File | undefined;
  let resizedUri: string | undefined;

  try {
    tempFile = new File(Paths.cache, `nsfw_${Date.now()}.jpg`);
    await File.downloadFileAsync(imageUrl, tempFile, { idempotent: true });

    const manipResult = await ImageManipulator.manipulateAsync(
      tempFile.uri,
      [{ resize: { width: 224, height: 224 } }],
      { format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 },
    );
    resizedUri = manipResult.uri;

    const resizedFile = new File(resizedUri);
    const imgB64 = await resizedFile.base64();

    const binaryStr = atob(imgB64);
    const imgBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      imgBytes[i] = binaryStr.charCodeAt(i);
    }

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
  } finally {
    try {
      if (tempFile && tempFile.exists) tempFile.delete();
      if (resizedUri) {
        const f = new File(resizedUri);
        if (f.exists) f.delete();
      }
    } catch { /* ignore cleanup errors */ }
  }
}
