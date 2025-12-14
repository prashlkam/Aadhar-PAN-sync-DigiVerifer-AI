// Convert Float32Array (Web Audio API default) to Int16Array (PCM)
export const float32ToInt16 = (float32: Float32Array): Int16Array => {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
};

// Convert Int16Array (PCM) to Float32Array
export const int16ToFloat32 = (int16: Int16Array): Float32Array => {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    const s = int16[i];
    float32[i] = s < 0 ? s / 0x8000 : s / 0x7FFF;
  }
  return float32;
};

// Base64 Encode ArrayBuffer
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Base64 Decode to ArrayBuffer
export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Simple Linear Interpolation Downsampler
export const downsampleTo16000 = (buffer: Float32Array, sampleRate: number): Float32Array => {
  if (sampleRate === 16000) return buffer;
  const ratio = sampleRate / 16000;
  const newLength = Math.ceil(buffer.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const offset = i * ratio;
    const index = Math.floor(offset);
    const nextIndex = Math.min(index + 1, buffer.length - 1);
    const fraction = offset - index;
    
    result[i] = buffer[index] * (1 - fraction) + buffer[nextIndex] * fraction;
  }
  return result;
};

// Create AudioBuffer from Int16 PCM Data
export const createAudioBufferFromPCM = (
  pcmData: Int16Array,
  context: AudioContext,
  sampleRate: number = 24000
): AudioBuffer => {
  const float32 = int16ToFloat32(pcmData);
  const buffer = context.createBuffer(1, float32.length, sampleRate);
  buffer.copyToChannel(float32, 0);
  return buffer;
};