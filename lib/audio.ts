'use client';

/**
 * Web Audio API 로 생성하는 칩튠 BGM + 효과음.
 * 외부 음원 파일 없이 오실레이터/노이즈만으로 만들며, 레벨이 오르면 템포가 빨라집니다.
 */

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// 4마디(64 step, 16분음표) 루프. 마디별 코드: Am - F - C - G
const BASS_ROOT = [45, 41, 48, 43]; // A2 F2 C3 G2
const BASS_STEPS = new Set([0, 3, 6, 8, 11, 14]);
const CHORD: number[][] = [
  [69, 72, 76, 81], // A4 C5 E5 A5
  [65, 69, 72, 77], // F4 A4 C5 F5
  [72, 76, 79, 84], // C5 E5 G5 C6
  [67, 71, 74, 79], // G4 B4 D5 G5
];
// 16 step 아르페지오 패턴 (-1 = 쉼표)
const LEAD_PATTERN = [0, 1, 2, 3, 2, 1, 0, 2, 3, -1, 2, 3, 1, 3, 2, -1];
const KICK_STEPS = new Set([0, 4, 8, 12]);
const SNARE_STEPS = new Set([4, 12]);

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private muted = false;
  private bpm = 138;
  private playing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;

  /** 사용자 제스처 이후에 호출해야 합니다 (브라우저 autoplay 정책). */
  init() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.35;
    this.master.connect(ctx.destination);
    this.bgmBus = ctx.createGain();
    this.bgmBus.gain.value = 0.55;
    this.bgmBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }
  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.35, this.ctx.currentTime, 0.02);
    }
  }
  isMuted() {
    return this.muted;
  }

  /** 레벨이 오르면 BPM 상승 → 급박한 느낌 */
  setLevel(level: number) {
    this.bpm = Math.min(200, 138 + (level - 1) * 8);
  }

  startBgm() {
    this.init();
    this.resume();
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopBgm() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
  }

  dispose() {
    this.stopBgm();
    void this.ctx?.close();
    this.ctx = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const secPerStep = 60 / this.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, secPerStep);
      this.nextTime += secPerStep;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number, dur: number) {
    const bar = Math.floor(step / 16);
    const s = step % 16;

    if (BASS_STEPS.has(s)) this.tone('square', midi(BASS_ROOT[bar]), t, dur * 1.6, 0.35, this.bgmBus);
    const li = LEAD_PATTERN[s];
    if (li >= 0) this.tone('square', midi(CHORD[bar][li]), t, dur * 0.9, 0.16, this.bgmBus);
    if (KICK_STEPS.has(s)) this.kick(t);
    if (SNARE_STEPS.has(s)) this.noise(t, 0.09, 0.28, 1800);
    if (s % 2 === 0) this.noise(t, 0.03, s % 4 === 2 ? 0.12 : 0.07, 7000);
  }

  // ---- 악기 ----
  private tone(
    type: OscillatorType,
    freq: number,
    t: number,
    dur: number,
    vol: number,
    bus: GainNode | null,
    slideTo?: number,
  ) {
    const ctx = this.ctx;
    if (!ctx || !bus) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    const ctx = this.ctx;
    if (!ctx || !this.bgmBus) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(this.bgmBus);
    o.start(t);
    o.stop(t + 0.16);
  }

  private noise(t: number, dur: number, vol: number, hp: number, bus = this.bgmBus) {
    const ctx = this.ctx;
    if (!ctx || !bus || !this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---- 효과음 ----
  sfxFlap() {
    if (!this.ctx) return;
    this.tone('square', 520, this.ctx.currentTime, 0.09, 0.25, this.sfxBus, 980);
  }
  sfxScore() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone('sine', 880, t, 0.08, 0.3, this.sfxBus);
    this.tone('sine', 1320, t + 0.07, 0.12, 0.3, this.sfxBus);
  }
  sfxLevelUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [659, 784, 988, 1319].forEach((f, i) => this.tone('square', f, t + i * 0.06, 0.1, 0.22, this.sfxBus));
  }
  sfxLife() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, t + i * 0.07, 0.16, 0.35, this.sfxBus));
  }
  sfxHit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.18, 0.5, 400, this.sfxBus);
    this.tone('sawtooth', 220, t, 0.22, 0.3, this.sfxBus, 70);
  }
  sfxGameOver() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone('sawtooth', 440, t, 0.7, 0.3, this.sfxBus, 90);
    this.tone('square', 330, t + 0.1, 0.6, 0.2, this.sfxBus, 70);
  }
}
