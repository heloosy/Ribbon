// Web Audio API Sound Effects for Ceremonial Ribbon Cutting
// Zero external audio files needed - 100% reliable in any browser

class SoundEngine {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // Realistic metallic scissors snip sound
  public playScissorsCut() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      // Noise burst for the physical shear
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.setValueAtTime(3200, now);
      bandpass.Q.setValueAtTime(4.0, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      noise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);

      // High frequency metallic blade resonance 'tink/chink'
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(4200, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);

      oscGain.gain.setValueAtTime(0.35, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Audio context error fallback
    }
  }

  // Majestic Inauguration Fanfare (brass trumpet arpeggios & chords)
  public playInaugurationFanfare() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      // Trumpet notes: C4, E4, G4, C5, with harmonic richness
      const notes = [
        { note: 261.63, start: 0.0, dur: 0.18, vol: 0.25 }, // C4
        { note: 329.63, start: 0.18, dur: 0.18, vol: 0.28 }, // E4
        { note: 392.0, start: 0.36, dur: 0.22, vol: 0.32 }, // G4
        { note: 523.25, start: 0.58, dur: 1.6, vol: 0.4 },  // C5 (held triumphant)
        // Harmony chord under high C
        { note: 392.0, start: 0.58, dur: 1.6, vol: 0.22 },  // G4
        { note: 329.63, start: 0.58, dur: 1.6, vol: 0.2 },  // E4
      ];

      notes.forEach(({ note, start, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Brass-like rich waveform (sawtooth with low-pass filter)
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(note, now + start);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1400, now + start);
        filter.frequency.exponentialRampToValueAtTime(600, now + start + dur);

        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.linearRampToValueAtTime(vol, now + start + 0.04);
        gain.gain.setValueAtTime(vol * 0.9, now + start + dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      });
    } catch {
      // Audio context error fallback
    }
  }

  // Celebratory crowd applause & cheering
  public playApplause() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;
      const duration = 3.2;

      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Pink noise-like randomized clapping density
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.18;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.setValueAtTime(1800, now);
      bandpass.Q.setValueAtTime(1.2, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.6);
      gain.gain.setValueAtTime(0.35, now + 1.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      source.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);

      source.start(now);
      source.stop(now + duration);
    } catch {
      // Audio context error fallback
    }
  }

  public playCelebrationSequence() {
    this.playScissorsCut();
    setTimeout(() => {
      this.playInaugurationFanfare();
      this.playApplause();
    }, 650);
  }
}

export const sound = new SoundEngine();
