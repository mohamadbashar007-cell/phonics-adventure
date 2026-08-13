class SoundEffectsService {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  async playSuccess() {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  async playCelebration() {
    const ctx = this.getContext();
    
    // Play a series of ascending tones for celebration
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const notes = [0, 0.1, 0.2, 0.3];
    
    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequencies[i], ctx.currentTime + notes[i]);

      gain.gain.setValueAtTime(0.15, ctx.currentTime + notes[i]);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + notes[i] + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + notes[i]);
      osc.stop(ctx.currentTime + notes[i] + 0.15);
    }
  }

  async playSuperCelebration() {
    const ctx = this.getContext();
    
    // Two ascending arpeggio patterns for extra enthusiasm
    const pattern1 = [523.25, 659.25, 783.99, 1046.50];
    const pattern2 = [1046.50, 783.99, 659.25, 523.25];
    
    for (let p = 0; p < 2; p++) {
      const pattern = p === 0 ? pattern1 : pattern2;
      for (let i = 0; i < pattern.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        const noteTime = ctx.currentTime + p * 0.6 + i * 0.1;
        osc.frequency.setValueAtTime(pattern[i], noteTime);

        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.08);
      }
    }
  }

  async playError() {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  async playClick() {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }
}

export const soundEffects = new SoundEffectsService();
