/**
 * radio-engine.js
 *
 * Core radio tuner engine for the Hydrogen Host Index Radio.
 *
 * Responsibilities:
 *   - Load the station directory
 *   - Manage playback of audio streams via HTMLAudioElement
 *   - Expose a Web Audio API analyser node for the visualizer
 *   - Handle the synthetic hydrogen-reference channel
 *   - Provide scan / tune / lock controls
 *
 * Usage (ES module):
 *   import { RadioEngine } from "./radio-engine.js";
 *   const radio = new RadioEngine();
 *   await radio.loadDirectory("./station-directory.json");
 *   radio.tune("soma-groove-salad");
 */

import { hydrogenReference, createHydrogenTone } from "./hydrogen-reference.js";
import { processSignal } from "./signal-compressor.js";

const SCAN_INTERVAL_MS = 3000; // time per station when scanning

class RadioEngine {
  constructor() {
    this._stations = [];
    this._currentStation = null;
    this._audioElement = null;
    this._audioContext = null;
    this._analyser = null;
    this._sourceNode = null;
    this._hydrogenOscillator = null;
    this._scanTimer = null;
    this._scanIndex = 0;
    this._onStationChange = null; // callback(station)
    this._onSignalData = null; // callback(Float32Array freqData)
  }

  /**
   * Fetch and parse the station directory JSON file.
   * @param {string} [url="./station-directory.json"]
   * @returns {Promise<object[]>} array of station objects
   */
  async loadDirectory(url = "./station-directory.json") {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load station directory: ${response.status}`);
    }
    const data = await response.json();
    this._stations = data.stations || [];
    return this._stations;
  }

  /** All loaded stations */
  get stations() {
    return this._stations;
  }

  /** Currently active station object or null */
  get currentStation() {
    return this._currentStation;
  }

  /** Web Audio AnalyserNode (connect visualizer to this) */
  get analyser() {
    return this._analyser;
  }

  /**
   * Register a callback invoked whenever the active station changes.
   * @param {function} cb - receives the new station object
   */
  onStationChange(cb) {
    this._onStationChange = cb;
  }

  // ── Audio context lifecycle ─────────────────────────────────────────────

  /** Lazily create (or resume) the AudioContext and shared AnalyserNode. */
  _ensureContext() {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this._analyser = this._audioContext.createAnalyser();
      this._analyser.fftSize = 2048;
      this._analyser.smoothingTimeConstant = 0.8;
      this._analyser.connect(this._audioContext.destination);
    }
    if (this._audioContext.state === "suspended") {
      this._audioContext.resume();
    }
  }

  // ── Playback controls ───────────────────────────────────────────────────

  /**
   * Tune to a station by its id string.
   * @param {string} stationId
   */
  tune(stationId) {
    const station = this._stations.find((s) => s.id === stationId);
    if (!station) {
      console.warn(`[RadioEngine] Unknown station id: ${stationId}`);
      return;
    }
    this._play(station);
  }

  /**
   * Tune to a station by its index in the stations array.
   * @param {number} index
   */
  tuneByIndex(index) {
    const station = this._stations[index];
    if (!station) return;
    this._play(station);
  }

  /** Stop playback and disconnect everything. */
  stop() {
    this._stopHydrogen();
    if (this._audioElement) {
      this._audioElement.pause();
      this._audioElement.src = "";
    }
    if (this._sourceNode) {
      try {
        this._sourceNode.disconnect();
      } catch (_) {
        // already disconnected
      }
      this._sourceNode = null;
    }
    this._currentStation = null;
    this._notifyStationChange(null);
  }

  /**
   * Scan stations sequentially, spending SCAN_INTERVAL_MS on each.
   * Call stop() or tune() to end the scan.
   */
  scanAll() {
    this._stopScan();
    this._scanIndex = 0;
    this._scanStep();
    this._scanTimer = setInterval(() => {
      this._scanIndex =
        (this._scanIndex + 1) % this._stations.length;
      this._scanStep();
    }, SCAN_INTERVAL_MS);
  }

  /** Advance one station upward in the list. */
  scanUp() {
    this._stopScan();
    const next =
      (this._stations.indexOf(this._currentStation) + 1) %
      this._stations.length;
    this.tuneByIndex(next);
  }

  /** Advance one station downward in the list. */
  scanDown() {
    this._stopScan();
    const cur = this._stations.indexOf(this._currentStation);
    const prev =
      (cur - 1 + this._stations.length) % this._stations.length;
    this.tuneByIndex(prev);
  }

  /**
   * Lock onto the current station (stop any active scan).
   * Alias for _stopScan() for API symmetry.
   */
  lockSignal() {
    this._stopScan();
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  _play(station) {
    this._ensureContext();
    this._stopScan();
    this._stopHydrogen();

    if (this._audioElement) {
      this._audioElement.pause();
    }
    if (this._sourceNode) {
      try {
        this._sourceNode.disconnect();
      } catch (_) {}
      this._sourceNode = null;
    }

    this._currentStation = station;
    this._notifyStationChange(station);

    if (station.id === "hydrogen-reference") {
      this._playHydrogenReference();
      return;
    }

    if (!station.stream) {
      console.info(`[RadioEngine] Station "${station.name}" has no stream.`);
      return;
    }

    if (!this._audioElement) {
      this._audioElement = new Audio();
      this._audioElement.crossOrigin = "anonymous";
    }

    this._audioElement.src = station.stream;
    this._sourceNode = this._audioContext.createMediaElementSource(
      this._audioElement
    );
    this._sourceNode.connect(this._analyser);

    const compressedBuffer = processSignal(new Float32Array(1024));
    void compressedBuffer; // processed — available for packet inspection

    this._audioElement.play().catch((err) => {
      console.warn(`[RadioEngine] Playback error: ${err.message}`);
    });
  }

  _playHydrogenReference() {
    const ref = hydrogenReference();
    console.info(
      `[RadioEngine] Playing hydrogen reference: ${ref.freqMHz} MHz`
    );
    this._hydrogenOscillator = createHydrogenTone(this._audioContext, 60);
    const gainNode = this._hydrogenOscillator.context
      ? null
      : this._audioContext.createGain();

    // Connect oscillator through analyser
    const osc = this._audioContext.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1420, this._audioContext.currentTime);

    const gain = this._audioContext.createGain();
    gain.gain.setValueAtTime(0.4, this._audioContext.currentTime);

    osc.connect(gain);
    gain.connect(this._analyser);
    osc.start();

    this._hydrogenOscillator = osc;
    void gainNode;
  }

  _stopHydrogen() {
    if (this._hydrogenOscillator) {
      try {
        this._hydrogenOscillator.stop();
        this._hydrogenOscillator.disconnect();
      } catch (_) {}
      this._hydrogenOscillator = null;
    }
  }

  _stopScan() {
    if (this._scanTimer !== null) {
      clearInterval(this._scanTimer);
      this._scanTimer = null;
    }
  }

  _scanStep() {
    if (this._stations.length === 0) return;
    this.tuneByIndex(this._scanIndex);
  }

  _notifyStationChange(station) {
    if (typeof this._onStationChange === "function") {
      this._onStationChange(station);
    }
  }
}

export { RadioEngine, SCAN_INTERVAL_MS };
