export type CompressionResult = {
  outputUri: string;
  compressed: boolean;
  strategy: 'ffmpeg' | 'passthrough';
  note?: string;
};

export const compressVideoOnDevice = async (inputUri: string): Promise<CompressionResult> => {
  try {
    // FFmpeg integration can be wired in a custom dev client.
    // In Expo managed runtime fallback to passthrough for reliability.
    return {
      outputUri: inputUri,
      compressed: false,
      strategy: 'passthrough',
      note: 'Compression fallback used (FFmpeg not available in managed runtime).'
    };
  } catch {
    return {
      outputUri: inputUri,
      compressed: false,
      strategy: 'passthrough',
      note: 'Compression failed; original video used.'
    };
  }
};
