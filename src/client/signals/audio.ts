import { withTimeout } from '../timeout.ts';
import type { RenderSignal } from './canvas.ts';

const SAMPLE_RATE = 44100;
const FRAME_COUNT = 5000;
const FIRST_SUMMED_FRAME = 4500;
const RENDER_TIMEOUT_MS = 1500;

const renderOnce = async (): Promise<string | undefined> => {
  if (typeof OfflineAudioContext === 'undefined') {
    return undefined;
  }
  const context = new OfflineAudioContext(1, FRAME_COUNT, SAMPLE_RATE);
  const oscillator = context.createOscillator();
  oscillator.type = 'triangle';
  oscillator.frequency.value = 10000;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -50;
  compressor.knee.value = 40;
  compressor.ratio.value = 12;
  compressor.attack.value = 0;
  compressor.release.value = 0.25;
  oscillator.connect(compressor);
  compressor.connect(context.destination);
  oscillator.start(0);
  const buffer = await withTimeout(context.startRendering(), RENDER_TIMEOUT_MS);
  if (buffer === undefined) {
    return undefined;
  }
  const samples = buffer.getChannelData(0);
  let sum = 0;
  for (let index = FIRST_SUMMED_FRAME; index < samples.length; index++) {
    sum += Math.abs(samples[index] ?? 0);
  }
  return sum.toString();
};

export const collectAudio = async (): Promise<RenderSignal | undefined> => {
  const [first, second] = await Promise.all([renderOnce(), renderOnce()]);
  if (first === undefined) {
    return undefined;
  }
  return { value: first, noised: first !== second };
};
