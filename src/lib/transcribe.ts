// ─────────────────────────────────────────────────────────────────
// Local transcription — FFmpeg (audio extraction) + Whisper (STT)
// Runs entirely on your machine. No external API, no cost.
// ─────────────────────────────────────────────────────────────────

import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

// Model: 'onnx-community/whisper-tiny' (fast, ~75 MB)
//        'onnx-community/whisper-base' (balanced, ~150 MB)
//        'onnx-community/whisper-small' (quality, ~500 MB)
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'onnx-community/whisper-small';

// ─── Types ───────────────────────────────────────────────────────

export interface TranscriptEntry {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  timestamp: string; // mm:ss
}

// ─── FFmpeg: extract audio as 16 kHz mono WAV ────────────────────

async function extractAudio(videoBuffer: Buffer): Promise<string> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `drime-in-${id}.webm`);
  const outputPath = join(tmpdir(), `drime-out-${id}.wav`);

  await writeFile(inputPath, videoBuffer);

  try {
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vn',              // strip video
      '-ar', '16000',     // 16 kHz (Whisper requirement)
      '-ac', '1',         // mono
      '-c:a', 'pcm_s16le', // 16-bit PCM
      '-f', 'wav',
      '-y',               // overwrite
      outputPath,
    ], { timeout: 180_000 }); // 3 min timeout
  } finally {
    await unlink(inputPath).catch(() => {});
  }

  return outputPath;
}

// ─── Read WAV → Float32Array (Whisper input) ─────────────────────

async function readWavAsFloat32(wavPath: string): Promise<Float32Array> {
  const buffer = await readFile(wavPath);

  // Find the 'data' chunk in the WAV file
  let dataOffset = 12; // skip RIFF header
  while (dataOffset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', dataOffset, dataOffset + 4);
    const chunkSize = buffer.readUInt32LE(dataOffset + 4);
    if (chunkId === 'data') {
      dataOffset += 8; // skip chunk header
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  // Convert 16-bit PCM samples → Float32
  const sampleCount = Math.floor((buffer.length - dataOffset) / 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = buffer.readInt16LE(dataOffset + i * 2) / 32768.0;
  }

  return float32;
}

// ─── Whisper pipeline (lazy loaded, cached in memory) ────────────

let _pipeline: any = null;

async function getWhisperPipeline() {
  if (_pipeline) return _pipeline;

  // Dynamic import — keeps it out of the webpack client bundle
  const { pipeline } = await import('@huggingface/transformers');

  console.log(`[Whisper] Downloading / loading model: ${WHISPER_MODEL} …`);
  console.log(`[Whisper] (first run downloads the model, subsequent runs use cache)`);

  _pipeline = await pipeline('automatic-speech-recognition', WHISPER_MODEL, {
    dtype: 'fp32',
    device: 'cpu',
  });

  console.log(`[Whisper] Model loaded ✓`);
  return _pipeline;
}

// ─── WebVTT formatting ───────────────────────────────────────────

function fmtVttTime(seconds: number): string {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  const ms = String(Math.round((seconds % 1) * 1000)).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

// ─── Main: transcribe a video buffer → WebVTT string ─────────────

export async function transcribeVideo(videoBuffer: Buffer): Promise<string> {
  // 1. Extract audio with FFmpeg
  console.log(`[Transcribe] Extracting audio with FFmpeg…`);
  const wavPath = await extractAudio(videoBuffer);
  console.log(`[Transcribe] Audio extracted → ${wavPath}`);

  try {
    // 2. Read WAV as Float32Array
    const audioData = await readWavAsFloat32(wavPath);
    console.log(`[Transcribe] Audio loaded: ${(audioData.length / 16000).toFixed(1)}s`);

    if (audioData.length < 1600) {
      // Less than 0.1 seconds — no meaningful audio
      return 'WEBVTT\n\n';
    }

    // 3. Run Whisper
    console.log(`[Transcribe] Running Whisper (${WHISPER_MODEL})…`);
    const whisper = await getWhisperPipeline();

    const result = await whisper(audioData, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    console.log(`[Transcribe] Whisper done — ${result.chunks?.length || 0} chunks`);

    // 4. Build WebVTT
    if (!result.chunks || result.chunks.length === 0) {
      return 'WEBVTT\n\n';
    }

    let vtt = 'WEBVTT\n\n';
    result.chunks.forEach((chunk: any, i: number) => {
      const start = chunk.timestamp?.[0] ?? 0;
      const end = chunk.timestamp?.[1] ?? start + 1;
      const text = (chunk.text || '').trim();
      if (!text) return;
      vtt += `${i + 1}\n${fmtVttTime(start)} --> ${fmtVttTime(end)}\n${text}\n\n`;
    });

    return vtt;
  } finally {
    // Clean up WAV
    await unlink(wavPath).catch(() => {});
  }
}

// ─── Utility: check if FFmpeg is installed ───────────────────────

export async function checkFFmpeg(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Always "configured" — no API key needed
export function isTranscriptionConfigured(): boolean {
  return true;
}

// Parse WebVTT string into structured entries (used by CommentsPanel)
export function parseWebVTT(vttContent: string): TranscriptEntry[] {
  const lines = vttContent.split('\n');
  const entries: TranscriptEntry[] = [];
  let currentId = 0;

  const timeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0] ?? '0', 10);
    const minutes = parseInt(parts[1] ?? '0', 10);
    const secondsParts = (parts[2] ?? '0').split('.');
    const seconds = parseInt(secondsParts[0] ?? '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split(' --> ');
      if (!startStr || !endStr) continue;
      const startTime = timeToSeconds(startStr.trim());
      const endTime = timeToSeconds(endStr.trim());
      const textLine = lines[i + 1]?.trim();
      if (textLine && textLine !== '' && !/^\d+$/.test(textLine)) {
        currentId++;
        const minutes = Math.floor(startTime / 60);
        const secs = Math.floor(startTime % 60);
        entries.push({
          id: currentId,
          startTime,
          endTime,
          text: textLine,
          timestamp: `${minutes}:${secs.toString().padStart(2, '0')}`,
        });
      }
    }
  }

  return entries;
}
