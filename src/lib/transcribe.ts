// ─────────────────────────────────────────────────────────────────
// Transcription client — calls Cloudflare Worker (Workers AI Whisper)
// No heavy dependencies. The Worker runs Whisper on Cloudflare's GPUs
// and reads the video directly from R2 (same Cloudflare account).
// ─────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────

export interface TranscriptEntry {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  timestamp: string; // mm:ss
}

interface WorkerResponse {
  success: boolean;
  text: string;
  vtt: string;
  words: { word: string; start: number; end: number }[];
  word_count: number;
  error?: string;
}

// ─── Call the Cloudflare Worker ──────────────────────────────────

export async function transcribeViaWorker(videoKey: string): Promise<string> {
  const workerUrl = process.env.TRANSCRIBE_WORKER_URL;
  const workerSecret = process.env.TRANSCRIBE_WORKER_SECRET;

  if (!workerUrl || !workerSecret) {
    throw new Error(
      'Transcription not configured. Set TRANSCRIBE_WORKER_URL and TRANSCRIBE_WORKER_SECRET in your environment.'
    );
  }

  console.log(`[Transcribe] Calling CF Worker for key: ${videoKey}`);

  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${workerSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key: videoKey }),
  });

  if (!response.ok) {
    const data: any = await response.json().catch(() => ({}));
    throw new Error(data.error || `Worker returned HTTP ${response.status}`);
  }

  const data: WorkerResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Transcription failed');
  }

  // Return VTT string — the Worker builds it from Whisper output
  return data.vtt || 'WEBVTT\n\n';
}

// ─── Check if transcription is configured ───────────────────────

export function isTranscriptionConfigured(): boolean {
  return !!(process.env.TRANSCRIBE_WORKER_URL && process.env.TRANSCRIBE_WORKER_SECRET);
}

// ─── Parse WebVTT → structured entries (used by transcript API) ─

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
    const ms = parseInt((secondsParts[1] ?? '0').padEnd(3, '0').slice(0, 3), 10);
    return hours * 3600 + minutes * 60 + seconds + ms / 1000;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split(' --> ');
      if (!startStr || !endStr) continue;
      const startTime = timeToSeconds(startStr.trim());
      const endTime = timeToSeconds(endStr.trim());

      // Collect all text lines for this cue (can be multi-line)
      let text = '';
      let j = i + 1;
      while (j < lines.length && lines[j]?.trim() !== '' && !/^\d+$/.test(lines[j]?.trim() ?? '')) {
        text += (text ? ' ' : '') + lines[j]!.trim();
        j++;
      }

      if (text) {
        currentId++;
        const minutes = Math.floor(startTime / 60);
        const secs = Math.floor(startTime % 60);
        entries.push({
          id: currentId,
          startTime,
          endTime,
          text,
          timestamp: `${minutes}:${secs.toString().padStart(2, '0')}`,
        });
      }
    }
  }

  return entries;
}
