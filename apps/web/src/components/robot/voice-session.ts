export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

function mergeSamples(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

export type PcmRecorderOptions = {
  capture?: boolean;
  onLevel?: (level: number) => void;
  preRollMs?: number;
};

export class PcmRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mute: GainNode | null = null;
  private chunks: Float32Array[] = [];
  private preRollChunks: Float32Array[] = [];
  private preRollSampleCount = 0;
  private preRollMaxSamples = 0;
  private capturing = true;
  private onLevel: ((level: number) => void) | undefined;

  async start(options: PcmRecorderOptions = {}): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("microphone_unavailable");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: { ideal: 16_000 },
        sampleSize: { ideal: 16 },
        autoGainControl: true,
        echoCancellation: false,
        noiseSuppression: true,
      },
    });
    this.context = new AudioContext({ sampleRate: 16_000 });
    await this.context.resume();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    this.mute = this.context.createGain();
    this.mute.gain.value = 0;
    this.chunks = [];
    this.preRollChunks = [];
    this.preRollSampleCount = 0;
    this.preRollMaxSamples = Math.max(0, Math.round(this.context.sampleRate * (options.preRollMs ?? 500) / 1000));
    this.capturing = options.capture ?? true;
    this.onLevel = options.onLevel;
    this.processor.onaudioprocess = (event) => {
      const samples = new Float32Array(event.inputBuffer.getChannelData(0));
      this.onLevel?.(calculateRms(samples));
      if (this.capturing) {
        this.chunks.push(samples);
      } else if (this.preRollMaxSamples > 0) {
        this.preRollChunks.push(samples);
        this.preRollSampleCount += samples.length;
        while (this.preRollChunks.length > 1 && this.preRollSampleCount - this.preRollChunks[0].length >= this.preRollMaxSamples) {
          this.preRollSampleCount -= this.preRollChunks.shift()?.length ?? 0;
        }
      }
    };
    this.source.connect(this.processor);
    this.processor.connect(this.mute);
    this.mute.connect(this.context.destination);
  }

  async stop(options: { release?: boolean } = {}): Promise<Blob> {
    if (!this.context || !this.stream) throw new Error("microphone_not_started");
    this.processor?.disconnect();
    this.source?.disconnect();
    this.mute?.disconnect();
    const sampleRate = this.context.sampleRate;
    const blob = new Blob([encodeWav(mergeSamples(this.chunks), sampleRate)], { type: "audio/wav" });
    this.chunks = [];
    this.preRollChunks = [];
    this.preRollSampleCount = 0;
    this.preRollMaxSamples = 0;
    this.capturing = true;
    this.onLevel = undefined;
    if (options.release !== false) await this.release();
    return blob;
  }

  beginCapture(): void {
    if (!this.context || !this.stream) throw new Error("microphone_not_started");
    this.chunks = this.preRollChunks.slice();
    this.preRollChunks = [];
    this.preRollSampleCount = 0;
    this.capturing = true;
  }

  cancel(): Promise<void> {
    return this.release();
  }

  private async release(): Promise<void> {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.mute?.disconnect();
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    const context = this.context;
    this.stream = null;
    this.context = null;
    this.source = null;
    this.processor = null;
    this.mute = null;
    this.chunks = [];
    this.preRollChunks = [];
    this.preRollSampleCount = 0;
    this.preRollMaxSamples = 0;
    this.capturing = true;
    this.onLevel = undefined;
    await context?.close();
  }
}
