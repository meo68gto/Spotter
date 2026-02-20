import * as FileSystem from 'expo-file-system';

export type CompressionResult = {
  outputUri: string;
  compressed: boolean;
  strategy: 'ffmpeg' | 'passthrough';
  note?: string;
  inputSizeBytes?: number;
  outputSizeBytes?: number;
  targetMaxBytes: number;
  estimatedBitrateKbps: number;
};

const TARGET_MAX_BYTES = 50 * 1024 * 1024;
const TARGET_ESTIMATED_BITRATE_KBPS = 4500;

export const compressVideoOnDevice = async (inputUri: string): Promise<CompressionResult> => {
  try {
    const info = await FileSystem.getInfoAsync(inputUri, { size: true });
    const inputSizeBytes = info.exists && typeof info.size === 'number' ? info.size : undefined;

    if (inputSizeBytes && inputSizeBytes <= TARGET_MAX_BYTES) {
      return {
        outputUri: inputUri,
        compressed: false,
        strategy: 'passthrough',
        note: 'Input already under target size threshold.',
        inputSizeBytes,
        outputSizeBytes: inputSizeBytes,
        targetMaxBytes: TARGET_MAX_BYTES,
        estimatedBitrateKbps: TARGET_ESTIMATED_BITRATE_KBPS
      };
    }

    // FFmpeg integration can be wired in a custom dev client.
    // In Expo managed runtime fallback to passthrough while preserving metadata targets.
    return {
      outputUri: inputUri,
      compressed: false,
      strategy: 'passthrough',
      note: 'Compression fallback used (FFmpeg not available in managed runtime).',
      inputSizeBytes,
      outputSizeBytes: inputSizeBytes,
      targetMaxBytes: TARGET_MAX_BYTES,
      estimatedBitrateKbps: TARGET_ESTIMATED_BITRATE_KBPS
    };
  } catch {
    return {
      outputUri: inputUri,
      compressed: false,
      strategy: 'passthrough',
      note: 'Compression failed; original video used.',
      targetMaxBytes: TARGET_MAX_BYTES,
      estimatedBitrateKbps: TARGET_ESTIMATED_BITRATE_KBPS
    };
  }
};
