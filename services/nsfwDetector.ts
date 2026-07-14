import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native/dist/platform_react_native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native/dist/bundle_resource_io';
import { decodeJpeg } from '@tensorflow/tfjs-react-native/dist/decode_image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Paths, File as FSFile, readAsStringAsync } from 'expo-file-system';

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

// ── EXIF ORIENTATION ──
// tfjs `decodeJpeg` (and expo-image-manipulator) ignore the EXIF Orientation
// tag, while the browser auto-applies it. To match the reference nsfwjs
// pipeline we must orient the image ourselves before classification.
async function getExifOrientation(uri: string): Promise<number> {
  try {
    // EXIF lives in the JPEG header; reading the first 64KB is plenty.
    const b64 = await readAsStringAsync(uri, {
      encoding: 'base64',
      length: 65536,
    });
    return parseExifOrientation(base64ToBytes(b64));
  } catch {
    return 1;
  }
}

function parseExifOrientation(bytes: Uint8Array): number {
  // JPEG must start with SOI (FFD8).
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;

  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1] & 0xff;

    // Stop once we reach the start of frame / scan data.
    if (marker === 0xda || (marker >= 0xc0 && marker <= 0xcf)) break;

    if (marker === 0xe1) {
      // APP1 segment — check for the "Exif\0\0" identifier.
      const segLen = ((bytes[offset + 2] << 8) | bytes[offset + 3]) & 0xffff;
      const exifStart = offset + 4;
      const hasExif =
        exifStart + 6 <= bytes.length &&
        bytes[exifStart] === 0x45 && bytes[exifStart + 1] === 0x78 &&
        bytes[exifStart + 2] === 0x69 && bytes[exifStart + 3] === 0x66 &&
        bytes[exifStart + 4] === 0x00 && bytes[exifStart + 5] === 0x00;
      if (hasExif) {
        const tiff = exifStart + 6;
        if (tiff + 8 > bytes.length) return 1;
        const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
        const read16 = (o: number) => {
          const a = bytes[o] & 0xff;
          const b = bytes[o + 1] & 0xff;
          return little ? a | (b << 8) : (a << 8) | b;
        };
        const read32 = (o: number) => {
          let v = 0;
          for (let i = 0; i < 4; i++) {
            const bb = bytes[o + i] & 0xff;
            v = little ? v | (bb << (8 * i)) : (v << 8) | bb;
          }
          return v >>> 0;
        };
        const ifd0 = tiff + read32(tiff + 4);
        if (ifd0 + 2 > bytes.length) return 1;
        const entries = read16(ifd0);
        for (let i = 0; i < entries; i++) {
          const entry = ifd0 + 2 + i * 12;
          if (entry + 12 > bytes.length) break;
          if (read16(entry) === 0x0112) {
            const orientation = read16(entry + 8);
            return orientation >= 1 && orientation <= 8 ? orientation : 1;
          }
        }
      }
      return 1;
    }

    // Standalone markers have no length field.
    if (
      marker === 0xd8 || marker === 0xd9 ||
      (marker >= 0x01 && marker <= 0xbf) ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    const segLen = ((bytes[offset + 2] << 8) | bytes[offset + 3]) & 0xffff;
    if (segLen <= 0) break;
    offset += 2 + segLen;
  }
  return 1;
}

async function loadImageAsJpegBytes(imageUrl: string): Promise<Uint8Array> {
  let rawFile: FSFile | null = null;
  let jpgFile: FSFile | null = null;

  try {
    rawFile = (await FSFile.downloadFileAsync(
      imageUrl,
      Paths.cache,
    )) as unknown as FSFile;

    // Orient the image per its EXIF tag so tfjs decodeJpeg sees the same
    // upright pixels the browser shows nsfwjs. Without this, rotated photos
    // feed a different (often misclassified) image than the reference.
    const orientation = await getExifOrientation(rawFile.uri);
    const ctx = ImageManipulator.manipulate(rawFile.uri);
    switch (orientation) {
      case 2: ctx.flip('horizontal'); break;
      case 3: ctx.rotate(180); break;
      case 4: ctx.flip('vertical'); break;
      case 5: ctx.flip('horizontal'); ctx.rotate(90); break;
      case 6: ctx.rotate(90); break;
      case 7: ctx.flip('horizontal'); ctx.rotate(270); break;
      case 8: ctx.rotate(270); break;
      default: break; // 1 = already upright
    }
    // Re-encode to JPEG and stretch to 224×224 natively (fast, offloaded from
    // the JS thread). Aspect ratio is not preserved — the model expects a
    // stretched 224×224 input. The resize happens here rather than in TF to
    // keep classification cheap and avoid blocking the UI during inference.
    const finalImage = await ctx.resize({ width: 224, height: 224 }).renderAsync();
    const manip = await finalImage.saveAsync({
      format: SaveFormat.JPEG,
      compress: 1,
      base64: true,
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
      } catch {}
    }

    if (jpgFile) {
      try {
        await jpgFile.delete();
      } catch {}
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

    // The image is already EXIF-oriented and resized to 224×224 natively (see
    // loadImageAsJpegBytes), so we only decode + normalize here. Using async
    // `data()` keeps the JS thread free so UI navigation stays responsive.
    const imageTensor = decodeJpeg(imgBytes, 3);
    const expanded = imageTensor.expandDims(0);
    // Normalize pixels to [0, 1] (÷ 255) — matches nsfwjs.
    const normalized = expanded.toFloat().div(255);
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
