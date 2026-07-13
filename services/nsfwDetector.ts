import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native/dist/platform_react_native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native/dist/bundle_resource_io';
import { decodeJpeg } from '@tensorflow/tfjs-react-native/dist/decode_image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Paths, File as FSFile } from 'expo-file-system';

// ── CONFIG ──
const CLASS_NAMES = ['Drawing', 'Hentai', 'Neutral', 'Porn', 'Sexy'] as const;

const THRESHOLDS: Record<string, number> = {
  Porn: 0.05,
  Hentai: 0.05,
  Sexy: 0.2,
};

let model: tf.GraphModel | null = null;
let initializing: Promise<void> | null = null;
let modelSettled: Promise<void> | null = null;

// ── PUBLIC API ──
export function isNSFWReady(): boolean {
  return model !== null;
}

export function initNSFWModel(): Promise<void> {
  if (model || initializing) return modelSettled!;

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
    } finally {
      initializing = null;
    }
  })();

  modelSettled = initializing;
  return modelSettled;
}

// Resolves when the model load attempt finishes (success OR failure).
export function whenNSFWModelSettled(): Promise<void> {
  return modelSettled ?? Promise.resolve();
}

export interface ClassificationResult {
  isNSFW: boolean;
  scores: Record<string, number>;
}

// Thrown when an image cannot be fetched or decoded into a raster the
// model can consume. Callers should treat this as "show broken image".
class ImageDecodeError extends Error {}

function base64ToBytes(base64: string): Uint8Array {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(123);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (a << 2) | (b >> 4);
    if (c !== undefined) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (d !== undefined) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

async function loadImageAsJpegBytes(imageUrl: string): Promise<Uint8Array> {
  // Download to a temp file (native decoder handles JPEG/PNG/GIF/WebP/HEIC…).
  let rawFile: FSFile | null = null;
  let jpgFile: FSFile | null = null;
  try {
    rawFile = (await FSFile.downloadFileAsync(
      imageUrl,
      Paths.cache,
    )) as unknown as FSFile;

    // Re-encode + resize to 224x224 via the native decoder. This makes the
    // subsequent JS-side jpeg-js decode negligible and offloads the heavy work
    // from the JS thread.
    const ctx = ImageManipulator.manipulate(rawFile.uri);
    ctx.resize({ width: 224, height: 224 });
    const imageRef = await ctx.renderAsync();
    const manip = await imageRef.saveAsync({
      format: SaveFormat.JPEG,
      base64: true,
      compress: 1,
    });

    if (!manip.base64) {
      throw new ImageDecodeError('No image data returned');
    }

    if (manip.uri) {
      jpgFile = new FSFile(manip.uri);
    }

    return base64ToBytes(manip.base64);
  } finally {
    if (rawFile) {
      try {
        await rawFile.delete();
      } catch {
        /* ignore */
      }
    }
    if (jpgFile) {
      try {
        await jpgFile.delete();
      } catch {
        /* ignore */
      }
    }
  }
}

export async function classifyImage(
  imageUrl: string,
  articleTitle?: string,
): Promise<ClassificationResult | null> {
  if (!model) return null;

  try {
    const imgBytes = await loadImageAsJpegBytes(imageUrl);

    // The image is already resized to 224x224 natively (see loadImageAsJpegBytes),
    // so we only decode + normalize here. Using async `data()` keeps the JS
    // thread free so UI navigation stays responsive during classification.
    const imageTensor = decodeJpeg(imgBytes, 3);
    const expanded = imageTensor.expandDims(0);
    const normalized = expanded.toFloat().div(127.5).sub(1);
    const output = model!.predict(normalized) as tf.Tensor;
    const probabilities = await output.data();
    tf.dispose([imageTensor, expanded, normalized, output]);

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
    // Distinguish "model not ready" (handled by caller returning null) from a
    // real decode failure (caller shows broken image).
    if (error instanceof ImageDecodeError) {
      console.warn('[NSFW] classifyImage failed (decode):', error.message);
      throw error;
    }
    console.warn('[NSFW] classifyImage failed:', error);
    return null;
  }
}

export { ImageDecodeError };
