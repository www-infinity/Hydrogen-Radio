/**
 * signal-compressor.js
 *
 * Lightweight digital signal compression utilities.
 * Reduces audio buffer bandwidth by filtering near-silent samples
 * and truncating to a standard packet size, simulating the kind of
 * compressed signal packets used in digital radio transmission.
 *
 * Supported strategies:
 *   "threshold" — discard samples below an amplitude floor
 *   "downsample" — keep every Nth sample (reduces sample rate)
 *   "slice"      — hard-truncate to packetSize samples
 */

const DEFAULT_THRESHOLD = 0.002; // amplitude floor (linear scale)
const DEFAULT_PACKET_SIZE = 44100; // ~1 second at 44.1 kHz
const DEFAULT_DOWNSAMPLE_FACTOR = 2; // keep every 2nd sample

/**
 * Removes near-silent samples and truncates to a fixed packet size.
 * This is the primary compression function described in the spec.
 *
 * @param {Float32Array|number[]} audioBuffer - raw PCM samples
 * @param {number} [threshold=DEFAULT_THRESHOLD] - amplitude floor
 * @param {number} [packetSize=DEFAULT_PACKET_SIZE] - max output length
 * @returns {Float32Array} compressed packet
 */
function compressSignal(
  audioBuffer,
  threshold = DEFAULT_THRESHOLD,
  packetSize = DEFAULT_PACKET_SIZE
) {
  if (!audioBuffer || audioBuffer.length === 0) {
    return new Float32Array(0);
  }

  const filtered = Array.from(audioBuffer).filter(
    (sample) => Math.abs(sample) > threshold
  );

  const sliced = filtered.slice(0, packetSize);
  return new Float32Array(sliced);
}

/**
 * Downsamples a buffer by keeping every Nth sample.
 * Reduces effective sample rate, compressing data volume.
 *
 * @param {Float32Array|number[]} audioBuffer - raw PCM samples
 * @param {number} [factor=DEFAULT_DOWNSAMPLE_FACTOR] - keep 1 in N samples
 * @returns {Float32Array} downsampled buffer
 */
function downsampleSignal(audioBuffer, factor = DEFAULT_DOWNSAMPLE_FACTOR) {
  if (!audioBuffer || audioBuffer.length === 0) {
    return new Float32Array(0);
  }

  const result = [];
  for (let i = 0; i < audioBuffer.length; i += factor) {
    result.push(audioBuffer[i]);
  }
  return new Float32Array(result);
}

/**
 * Normalises sample amplitudes to the range [-1, 1].
 * Prevents clipping after compression/expansion cycles.
 *
 * @param {Float32Array|number[]} audioBuffer - PCM samples
 * @returns {Float32Array} normalised buffer
 */
function normaliseSignal(audioBuffer) {
  if (!audioBuffer || audioBuffer.length === 0) {
    return new Float32Array(0);
  }

  let peak = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    const abs = Math.abs(audioBuffer[i]);
    if (abs > peak) peak = abs;
  }

  if (peak === 0) return new Float32Array(audioBuffer.length);

  const out = new Float32Array(audioBuffer.length);
  for (let i = 0; i < audioBuffer.length; i++) {
    out[i] = audioBuffer[i] / peak;
  }
  return out;
}

/**
 * High-level pipeline: compress → downsample → normalise.
 *
 * @param {Float32Array|number[]} audioBuffer
 * @param {object} [options]
 * @param {number} [options.threshold]
 * @param {number} [options.packetSize]
 * @param {number} [options.downsampleFactor]
 * @returns {Float32Array}
 */
function processSignal(audioBuffer, options = {}) {
  const {
    threshold = DEFAULT_THRESHOLD,
    packetSize = DEFAULT_PACKET_SIZE,
    downsampleFactor = DEFAULT_DOWNSAMPLE_FACTOR,
  } = options;

  let signal = compressSignal(audioBuffer, threshold, packetSize);
  signal = downsampleSignal(signal, downsampleFactor);
  signal = normaliseSignal(signal);
  return signal;
}

export {
  compressSignal,
  downsampleSignal,
  normaliseSignal,
  processSignal,
  DEFAULT_THRESHOLD,
  DEFAULT_PACKET_SIZE,
  DEFAULT_DOWNSAMPLE_FACTOR,
};
