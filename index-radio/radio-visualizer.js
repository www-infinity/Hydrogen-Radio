/**
 * radio-visualizer.js
 *
 * Real-time audio spectrum visualizer for the Hydrogen Host Index Radio.
 *
 * Visual modes:
 *   "waterfall"  — scrolling frequency waterfall (SDR-style)
 *   "oscilloscope" — time-domain waveform
 *   "particles"  — particle field driven by frequency bands
 *   "galaxy"     — signal galaxy with rotating star-like particles
 *
 * Usage:
 *   import { RadioVisualizer } from "./radio-visualizer.js";
 *   const vis = new RadioVisualizer(canvasElement, analyserNode);
 *   vis.setMode("waterfall");
 *   vis.start();
 */

const MODES = ["waterfall", "oscilloscope", "particles", "galaxy"];

/**
 * Spawns and animates a single particle used by "particles" and "galaxy" modes.
 * @private
 */
class Particle {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
  }

  reset() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * Math.min(cx, cy) * 0.8;
    this.x = cx + Math.cos(angle) * radius;
    this.y = cy + Math.sin(angle) * radius;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;
    this.life = 1;
    this.decay = 0.005 + Math.random() * 0.015;
    this.radius = 1 + Math.random() * 2;
    this.hue = 120 + Math.random() * 60; // green-cyan range
  }

  update(energy) {
    const speed = 1 + energy * 3;
    this.x += this.vx * speed;
    this.y += this.vy * speed;
    this.life -= this.decay;
    this.hue = (this.hue + 0.5) % 360;
    if (this.life <= 0) this.reset();
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.hue}, 100%, 60%, ${this.life})`;
    ctx.fill();
  }
}

class RadioVisualizer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {AnalyserNode} analyser
   */
  constructor(canvas, analyser) {
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d");
    this._analyser = analyser;
    this._mode = "waterfall";
    this._running = false;
    this._animId = null;
    this._waterfallOffset = 0;
    this._particles = [];
    this._galaxyAngle = 0;

    this._freqBuffer = null;
    this._timeBuffer = null;

    this._initParticles(200);
    this._bindResize();
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Switch visual mode.
   * @param {"waterfall"|"oscilloscope"|"particles"|"galaxy"} mode
   */
  setMode(mode) {
    if (!MODES.includes(mode)) {
      console.warn(`[RadioVisualizer] Unknown mode: ${mode}`);
      return;
    }
    this._mode = mode;
  }

  get mode() {
    return this._mode;
  }

  /** Whether the animation loop is currently running. */
  get isRunning() {
    return this._running;
  }

  /** Start the animation loop. */
  start() {
    if (this._running) return;
    this._running = true;
    this._loop();
  }

  /** Stop the animation loop. */
  stop() {
    this._running = false;
    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  /**
   * Render a single frame using externally-supplied frequency data.
   * Useful for testing without a live analyser.
   *
   * @param {Uint8Array} freqData - FFT magnitude data (0–255)
   */
  renderFrame(freqData) {
    this._renderWithData(freqData);
  }

  // ── Private: animation loop ──────────────────────────────────────────

  _loop() {
    if (!this._running) return;

    this._ensureBuffers();

    this._analyser.getByteFrequencyData(this._freqBuffer);
    this._analyser.getByteTimeDomainData(this._timeBuffer);

    this._renderWithData(this._freqBuffer, this._timeBuffer);

    this._animId = requestAnimationFrame(() => this._loop());
  }

  _ensureBuffers() {
    const size = this._analyser.frequencyBinCount;
    if (!this._freqBuffer || this._freqBuffer.length !== size) {
      this._freqBuffer = new Uint8Array(size);
      this._timeBuffer = new Uint8Array(size);
    }
  }

  _renderWithData(freqData, timeData) {
    switch (this._mode) {
      case "waterfall":
        this._drawWaterfall(freqData);
        break;
      case "oscilloscope":
        this._drawOscilloscope(timeData || freqData);
        break;
      case "particles":
        this._drawParticles(freqData);
        break;
      case "galaxy":
        this._drawGalaxy(freqData);
        break;
    }
  }

  // ── Render modes ──────────────────────────────────────────────────────

  /** Scrolling waterfall spectrum — classic SDR display */
  _drawWaterfall(freqData) {
    const { width, height } = this._canvas;
    const ctx = this._ctx;
    const sliceHeight = 2;

    // Shift existing image downward
    ctx.drawImage(this._canvas, 0, sliceHeight);

    // Draw new frequency slice at the top
    const binWidth = width / freqData.length;
    for (let i = 0; i < freqData.length; i++) {
      const magnitude = freqData[i] / 255;
      // Hydrogen-green colour palette
      const r = Math.floor(magnitude * 40);
      const g = Math.floor(magnitude * 220);
      const b = Math.floor(magnitude * 100);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(i * binWidth, 0, binWidth, sliceHeight);
    }
  }

  /** Classic oscilloscope time-domain waveform */
  _drawOscilloscope(timeData) {
    const { width, height } = this._canvas;
    const ctx = this._ctx;

    ctx.fillStyle = "rgba(0, 10, 0, 0.85)";
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#00ff66";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#00ff66";
    ctx.beginPath();

    const sliceWidth = width / (timeData ? timeData.length : 1);
    let x = 0;

    for (let i = 0; i < (timeData ? timeData.length : 0); i++) {
      const v = (timeData[i] / 128.0) - 1;
      const y = (v * height) / 2 + height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /** Particle field — each frequency band spawns energy particles */
  _drawParticles(freqData) {
    const { width, height } = this._canvas;
    const ctx = this._ctx;

    ctx.fillStyle = "rgba(0, 0, 20, 0.15)";
    ctx.fillRect(0, 0, width, height);

    const avgEnergy =
      Array.from(freqData).reduce((a, b) => a + b, 0) /
      freqData.length /
      255;

    this._particles.forEach((p) => {
      p.update(avgEnergy);
      p.draw(ctx);
    });

    // Render per-band bars as a subtle frequency underlay
    renderFrequencyBars(freqData, ctx, width, height);
  }

  /** Signal galaxy — rotating star field driven by frequency */
  _drawGalaxy(freqData) {
    const { width, height } = this._canvas;
    const ctx = this._ctx;
    const cx = width / 2;
    const cy = height / 2;

    ctx.fillStyle = "rgba(0, 0, 15, 0.12)";
    ctx.fillRect(0, 0, width, height);

    this._galaxyAngle += 0.002;
    const numArms = 3;
    const binsPerArm = Math.floor(freqData.length / numArms);

    for (let arm = 0; arm < numArms; arm++) {
      const baseAngle = (arm / numArms) * Math.PI * 2 + this._galaxyAngle;

      for (let i = 0; i < binsPerArm; i++) {
        const magnitude = freqData[arm * binsPerArm + i] / 255;
        if (magnitude < 0.05) continue;

        const t = i / binsPerArm;
        const spiralAngle = baseAngle + t * Math.PI * 2.5;
        const r = t * Math.min(cx, cy) * 0.9;
        const x = cx + Math.cos(spiralAngle) * r;
        const y = cy + Math.sin(spiralAngle) * r;

        const hue = 180 + magnitude * 180;
        const alpha = 0.4 + magnitude * 0.6;
        const size = 1 + magnitude * 3;

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${alpha})`;
        ctx.fill();
      }
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────

  _initParticles(count) {
    for (let i = 0; i < count; i++) {
      this._particles.push(new Particle(this._canvas));
    }
  }

  _bindResize() {
    const resize = () => {
      this._canvas.width = this._canvas.offsetWidth || window.innerWidth;
      this._canvas.height = this._canvas.offsetHeight || 300;
      // Reset and reinitialise particles for the new canvas dimensions
      this._particles = [];
      this._initParticles(200);
    };
    window.addEventListener("resize", resize);
    resize();
  }
}

/**
 * Renders per-band frequency energy as glowing bars (frequency underlay).
 * Used by the particle-field visual mode as a background layer.
 *
 * @param {Uint8Array} freqData
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function renderFrequencyBars(freqData, ctx, width, height) {
  const step = Math.ceil(freqData.length / 64);
  for (let i = 0; i < freqData.length; i += step) {
    const magnitude = freqData[i] / 255;
    const x = (i / freqData.length) * width;
    const barHeight = magnitude * height * 0.5;
    const hue = 120 + magnitude * 120;

    ctx.fillStyle = `hsla(${hue}, 100%, 55%, ${0.2 + magnitude * 0.5})`;
    ctx.fillRect(x, height - barHeight, width / 64, barHeight);
  }
}

export { RadioVisualizer, renderFrequencyBars, MODES };
