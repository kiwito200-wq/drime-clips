// ─────────────────────────────────────────────────────────────────
// Cloudflare Worker — Transcription via Workers AI (Whisper)
// Reads video directly from R2, runs Whisper, returns VTT.
// Zero external dependencies. Deploys in seconds.
// ─────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    // ── CORS ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // ── Auth ──
    const auth = request.headers.get('Authorization');
    if (auth !== `Bearer ${env.TRANSCRIBE_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const { url } = await request.json();

      if (!url) {
        return Response.json({ error: 'Missing "url" in request body' }, { status: 400 });
      }

      // ── Fetch video via presigned URL ──
      console.log(`[Transcribe] Fetching video from presigned URL...`);
      const videoResponse = await fetch(url);
      if (!videoResponse.ok) {
        return Response.json(
          { error: `Failed to fetch video: HTTP ${videoResponse.status}` },
          { status: 502 }
        );
      }

      const audioData = await videoResponse.arrayBuffer();
      console.log(`[Transcribe] Processing video (${(audioData.byteLength / 1024 / 1024).toFixed(1)} MB)`);

      // ── Run Whisper via Workers AI ──
      const result = await env.AI.run('@cf/openai/whisper', {
        audio: [...new Uint8Array(audioData)],
      });

      console.log(`[Transcribe] Done: ${result.word_count || 0} words, has words array: ${!!(result.words && result.words.length)}`);

      // ── Build VTT — prefer word-level timestamps (accurate) over built-in VTT (often broken timestamps) ──
      let vtt = '';

      if (result.words && result.words.length > 0) {
        // Best path: build from word-level timestamps for accurate seek
        vtt = buildVttFromWords(result.words);
      } else if (result.vtt) {
        // Fallback: use built-in VTT from Whisper
        vtt = result.vtt;
      }

      // Last resort: single-cue VTT from full text
      if (!vtt && result.text) {
        vtt = `WEBVTT\n\n1\n00:00:00.000 --> 99:59:59.000\n${result.text}\n\n`;
      }

      return Response.json({
        success: true,
        text: result.text || '',
        vtt: vtt || 'WEBVTT\n\n',
        words: result.words || [],
        word_count: result.word_count || 0,
      });
    } catch (error) {
      console.error('[Transcribe] Error:', error);
      return Response.json(
        { error: error.message || 'Transcription failed' },
        { status: 500 }
      );
    }
  },
};

// ── Build WebVTT from word-level timestamps ──
// Groups words into ~8-second segments for a nice reading experience
function buildVttFromWords(words) {
  let vtt = 'WEBVTT\n\n';
  let segmentStart = null;
  let segmentEnd = null;
  let segmentText = '';
  let cueIndex = 1;
  const SEGMENT_DURATION = 8; // seconds

  for (const w of words) {
    if (segmentStart === null) {
      segmentStart = w.start;
    }
    segmentEnd = w.end;
    segmentText += (segmentText ? ' ' : '') + w.word;

    // Flush segment if duration exceeded or at sentence boundary
    const duration = segmentEnd - segmentStart;
    const isSentenceEnd = /[.!?]$/.test(w.word);

    if (duration >= SEGMENT_DURATION || (duration >= 3 && isSentenceEnd)) {
      vtt += `${cueIndex}\n`;
      vtt += `${fmtTime(segmentStart)} --> ${fmtTime(segmentEnd)}\n`;
      vtt += `${segmentText.trim()}\n\n`;
      cueIndex++;
      segmentStart = null;
      segmentEnd = null;
      segmentText = '';
    }
  }

  // Flush remaining
  if (segmentText.trim() && segmentStart !== null) {
    vtt += `${cueIndex}\n`;
    vtt += `${fmtTime(segmentStart)} --> ${fmtTime(segmentEnd || segmentStart + 1)}\n`;
    vtt += `${segmentText.trim()}\n\n`;
  }

  return vtt;
}

function fmtTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  const ms = String(Math.round((seconds % 1) * 1000)).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}
