// AudioWorklet processor: captures mic audio and resamples to 24kHz PCM16
// This file runs in an AudioWorklet thread (not main thread)

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    // Send a chunk every ~100ms worth of audio (2400 samples at 24kHz)
    this.chunkSize = 2400;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // Float32 mono
    const inputSampleRate = sampleRate; // global in AudioWorklet scope
    const targetRate = 24000;

    // Simple linear resampling
    const ratio = inputSampleRate / targetRate;
    for (let i = 0; i < channelData.length / ratio; i++) {
      const srcIndex = Math.floor(i * ratio);
      const sample = channelData[srcIndex] || 0;
      // Float32 → Int16
      const int16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
      this.buffer.push(int16);
    }

    // Send when we have enough data
    while (this.buffer.length >= this.chunkSize) {
      const chunk = this.buffer.splice(0, this.chunkSize);
      const int16Array = new Int16Array(chunk);
      // Send raw Int16Array buffer to main thread
      this.port.postMessage({ type: "audio", data: int16Array.buffer }, [int16Array.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
