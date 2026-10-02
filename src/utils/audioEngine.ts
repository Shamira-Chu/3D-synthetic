class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private skateNoiseNode: AudioNode | null = null;
  private skateGain: GainNode | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private masterVolume: number = 0.8;
  private skateSoundEnabled: boolean = true;

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.skateGain && this.ctx) {
      const g = (this.isMuted || !this.skateSoundEnabled) ? 0 : 0.05 * this.masterVolume;
      this.skateGain.gain.setValueAtTime(g, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.skateGain && this.ctx) {
      const g = (this.isMuted || !this.skateSoundEnabled) ? 0 : 0.05 * this.masterVolume;
      this.skateGain.gain.setValueAtTime(g, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public setSkateSoundEnabled(enabled: boolean) {
    this.skateSoundEnabled = enabled;
    if (this.skateGain && this.ctx) {
      const g = (this.isMuted || !this.skateSoundEnabled) ? 0 : 0.05 * this.masterVolume;
      this.skateGain.gain.setValueAtTime(g, this.ctx.currentTime);
    }
  }

  public getSkateSoundEnabled(): boolean {
    return this.skateSoundEnabled;
  }

  // Play realistic pealess referee whistle (Fox 40 characteristic double frequency chirp: ~2800Hz + ~3100Hz with vibrato)
  public playWhistle(type: 'start' | 'lead' | 'penalty' | 'calloff' | 'timeout' = 'start') {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      if (type === 'start') {
        // One solid high blast (0.35s)
        this.synthSingleWhistle(now, 0.4, 1.0);
      } else if (type === 'lead') {
        // Two crisp staccato chirps ("tweet-tweet!")
        this.synthSingleWhistle(now, 0.12, 0.9);
        this.synthSingleWhistle(now + 0.18, 0.18, 1.0);
      } else if (type === 'penalty') {
        // One loud harsh blast
        this.synthSingleWhistle(now, 0.55, 1.1, true);
      } else if (type === 'calloff') {
        // 4 rapid blasts (TWEET TWEET TWEET TWEET!)
        for (let i = 0; i < 4; i++) {
          this.synthSingleWhistle(now + i * 0.16, 0.11, 0.95);
        }
      } else if (type === 'timeout') {
        // Multiple cascading chirps
        for (let i = 0; i < 3; i++) {
          this.synthSingleWhistle(now + i * 0.22, 0.16, 0.85);
        }
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }

  private synthSingleWhistle(startTime: number, duration: number, volume: number = 1.0, isHarsh: boolean = false) {
    if (!this.ctx) return;

    // Dual oscillator for authentic acoustic trill / multiphonic whistle sound
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    // Modulator for the Fox40 pealess chaotic flutter
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();

    vibrato.frequency.setValueAtTime(isHarsh ? 45 : 32, startTime);
    vibratoGain.gain.setValueAtTime(80, startTime);
    vibrato.connect(osc1.frequency);
    vibrato.connect(osc2.frequency);

    osc1.type = 'triangle';
    osc2.type = 'sine';

    const baseFreq = isHarsh ? 2950 : 2750;
    osc1.frequency.setValueAtTime(baseFreq, startTime);
    osc2.frequency.setValueAtTime(baseFreq + 320, startTime);

    // Envelope
    gainNode.gain.setValueAtTime(0.001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.28 * volume, startTime + 0.02);
    gainNode.gain.setValueAtTime(0.24 * volume, startTime + duration - 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    // Filter to give crisp stadium resonance
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, startTime);
    filter.Q.setValueAtTime(4.0, startTime);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(filter);
    filter.connect(this.ctx.destination);

    vibrato.start(startTime);
    osc1.start(startTime);
    osc2.start(startTime);

    vibrato.stop(startTime + duration + 0.05);
    osc1.stop(startTime + duration + 0.05);
    osc2.stop(startTime + duration + 0.05);
  }

  // Play roller derby scoreboard buzzer / air horn
  public playBuzzer() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(210, now + 0.8);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.setValueAtTime(0.18, now + 0.7);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.85);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      osc.connect(gain);
      gain.connect(filter);
      filter.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.9);
    } catch {
      // Ignored
    }
  }

  // Play crowd cheer
  public playCheer() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const bufferSize = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
    } catch {
      // Ignored
    }
  }

  // Play interactive click/select UI sound
  public playClick(pitch: number = 600) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, now + 0.06);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignored
    }
  }

  // Play portal teleport sound effect
  public playTeleport() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.linearRampToValueAtTime(2000, now + 0.35);

      osc.connect(gain);
      gain.connect(filter);
      filter.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.42);
    } catch {
      // Ignored
    }
  }

  // Play card roulette click tick
  public playCardTick() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.03);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Ignored
    }
  }

  // Play Kings League Secret Card reveal fanfare
  public playCardFanfare() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const now = this.ctx!.currentTime + idx * 0.09;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      });
    } catch {
      // Ignored
    }
  }

  // Play score point / star collected chime
  public playPointChime(combo: number = 1) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const baseFreq = 587.33 * Math.min(1 + combo * 0.1, 2.2); // D5
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Ignored
    }
  }

  // Play blocker bump / body check impact
  public playImpact() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Ignored
    }
  }

  // Realistic continuous roller skate roll sound on arena floor
  private skateLoopSource: AudioBufferSourceNode | null = null;
  private skateFilter: BiquadFilterNode | null = null;

  public startSkateLoop() {
    if (this.skateLoopSource) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02; // Pink noise
        data[i] = lastOut * 3.5;
      }

      this.skateLoopSource = this.ctx.createBufferSource();
      this.skateLoopSource.buffer = buffer;
      this.skateLoopSource.loop = true;

      this.skateFilter = this.ctx.createBiquadFilter();
      this.skateFilter.type = 'lowpass';
      this.skateFilter.frequency.setValueAtTime(400, this.ctx.currentTime);

      this.skateGain = this.ctx.createGain();
      this.skateGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, this.ctx.currentTime);

      this.skateLoopSource.connect(this.skateFilter);
      this.skateFilter.connect(this.skateGain);
      this.skateGain.connect(this.ctx.destination);

      this.skateLoopSource.start(0);
    } catch {
      // Ignored
    }
  }

  public updateSkateSpeed(speedNorm: number) {
    if (!this.skateFilter || !this.skateGain || !this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const targetFreq = 300 + Math.min(speedNorm, 2.5) * 450;
      const targetGain = Math.min(0.09, 0.02 + speedNorm * 0.035);
      this.skateFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
      this.skateGain.gain.setTargetAtTime(targetGain, now, 0.08);
    } catch {
      // Ignored
    }
  }

  public stopSkateLoop() {
    if (this.skateLoopSource) {
      try {
        this.skateLoopSource.stop();
        this.skateLoopSource.disconnect();
      } catch {
        // Ignored
      }
      this.skateLoopSource = null;
    }
  }

  // Play apex jump wind whoosh
  public playApexWhoosh() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.5);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(350, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.2);
      filter.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.48);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.14, this.ctx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.48);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch {
      // Ignored
    }
  }

  // Play skate slide / skid on track
  public playSkateSlide() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.2);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Ignored
    }
  }

  // Play powerful body check / blocker stun hit
  public playStunHit() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Punchy thump
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);
      gain.gain.setValueAtTime(0.35 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);

      // Stun dizzy chirp
      const chirp = this.ctx.createOscillator();
      const chirpGain = this.ctx.createGain();
      chirp.type = 'sine';
      chirp.frequency.setValueAtTime(800, now + 0.05);
      chirp.frequency.linearRampToValueAtTime(1400, now + 0.15);
      chirp.frequency.linearRampToValueAtTime(600, now + 0.28);
      chirpGain.gain.setValueAtTime(0.12 * this.masterVolume, now + 0.05);
      chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      chirp.connect(chirpGain);
      chirpGain.connect(this.ctx.destination);
      chirp.start(now + 0.05);
      chirp.stop(now + 0.32);
    } catch {
      // Ignored
    }
  }

  // Play powerup collectible pickup chime
  public playPowerupPickup() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      freqs.forEach((f, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.05);
        gain.gain.setValueAtTime(0.14 * this.masterVolume, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.25);
      });
    } catch {
      // Ignored
    }
  }

  // Play nitro rocket boost whoosh
  public playNitro() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.35);
      gain.gain.setValueAtTime(0.25 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Ignored
    }
  }
}

export const soundManager = new AudioEngine();
