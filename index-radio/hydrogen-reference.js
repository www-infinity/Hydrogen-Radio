/**
 * hydrogen-reference.js
 *
 * Generates a synthetic reference signal representing the
 * 21-cm neutral hydrogen spectral line (1420.405751 MHz).
 *
 * The hydrogen line is produced when the electron in a neutral
 * hydrogen atom flips its spin relative to the proton — a quantum
 * transition that releases a photon at exactly this frequency.
 * It is the most abundant signal in the universe and serves as a
 * universal reference channel for this project.
 */

const HYDROGEN_FREQUENCY_HZ = 1420405751.77; // Hz (exact)
const HYDROGEN_FREQUENCY_MHZ = 1420.405; // MHz (display)
const HYDROGEN_WAVELENGTH_M = 0.21106; // metres

/**
 * Returns the static physical properties of the hydrogen line.
 * @returns {{ freq: number, freqMHz: number, wavelength: number, description: string }}
 */
function hydrogenReference() {
  return {
    freq: HYDROGEN_FREQUENCY_HZ,
    freqMHz: HYDROGEN_FREQUENCY_MHZ,
    wavelength: HYDROGEN_WAVELENGTH_M,
    description: "21-cm neutral hydrogen spectral line",
  };
}

/**
 * Generates a time-domain sinusoidal waveform that represents the
 * hydrogen reference signal scaled to an audible proxy frequency.
 *
 * Because 1420 MHz cannot be played through speakers directly, the
 * signal is mapped to a 1420 Hz audible tone so visualizers and
 * oscilloscopes can display a realistic sine wave.
 *
 * @param {AudioContext} audioContext - Web Audio API context
 * @param {number} [durationSeconds=5] - how long to play the tone
 * @returns {OscillatorNode} configured oscillator (not yet started)
 */
function createHydrogenTone(audioContext, durationSeconds = 5) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  // Audible proxy: 1420 Hz represents 1420 MHz
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(1420, audioContext.currentTime);

  gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(
    0,
    audioContext.currentTime + durationSeconds
  );

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  return oscillator;
}

/**
 * Builds a synthetic Float32Array PCM buffer that approximates a
 * sine wave at the proxy hydrogen frequency (1420 Hz).
 *
 * Useful for offline processing and signal-compression testing.
 *
 * @param {number} [sampleRate=44100] - audio sample rate in Hz
 * @param {number} [durationSeconds=1] - length of the buffer
 * @returns {Float32Array}
 */
function buildHydrogenBuffer(sampleRate = 44100, durationSeconds = 1) {
  const proxyFreq = 1420; // audible proxy Hz
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    buffer[i] = Math.sin((2 * Math.PI * proxyFreq * i) / sampleRate);
  }

  return buffer;
}

export {
  hydrogenReference,
  createHydrogenTone,
  buildHydrogenBuffer,
  HYDROGEN_FREQUENCY_HZ,
  HYDROGEN_FREQUENCY_MHZ,
  HYDROGEN_WAVELENGTH_M,
};
