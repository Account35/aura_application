---
name: speech-to-text
description: Transcribe audio files or URLs to text using Whisper v3, supporting 100+ languages, speaker diarization, and multiple output formats (JSON/SRT/VTT/verbose_json). Use this skill whenever the user wants to convert speech or audio to text, generate subtitles, transcribe podcasts, recognize speakers, or process audio files into readable transcripts.
license: MIT
---

# Speech-to-Text (Audio Transcription)

Powered by the Whisper large-v3 model via the LemonFox API. Converts audio files or public audio URLs into text transcripts with support for 100+ languages, speaker recognition, word-level timestamps, and multiple output formats.

**Pricing:** $0.05 per call (discounted) / $0.10 original price — billed per API call.

---

## Overview

| Property | Value |
|----------|-------|
| Endpoint | `POST https://app-b0t9jb6nl2pt-api-DY8MNQoqOnMa.gateway.appmedo.com/v1/audio/transcriptions` |
| Auth | Bearer Token (platform_managed, `X-Gateway-Authorization` header) |
| Content-Type | `multipart/form-data` (file upload) or `application/x-www-form-urlencoded` (URL submission) |
| Max File Size | Upload: 100 MB; URL submission: 1 GB |
| Supported Formats | mp3, wav, flac, aac, opus, ogg, m4a, mp4, mpeg, mov, webm, and more |
| Supported Languages | 100+, auto-detected if not specified |
| Pricing | $0.05 / call (discounted) |

**Core capabilities:**
- Audio-to-text transcription, returning plain text or detailed JSON with timestamps
- Multi-speaker recognition (Speaker Diarization), automatically labels each speaker
- Multiple output formats: `json`, `text`, `srt`, `vtt`, `verbose_json`
- Supports async callback via `callback_url`
- Supports translating audio content to English

> For complete parameter details, response fields, and code examples, see `references/transcriptions-api.md`.

---

## Generation-time Usage (Agent Direct Call)

The platform injects the API key — no user-supplied key is needed.

> For complete TypeScript code (URL submission and local file upload), see the "Generation-time Usage" section in `references/transcriptions-api.md`.

---

## Post-generation Usage (In-app via Edge Function)

When called from within an application, requests must be proxied through an Edge Function to keep the platform key out of the frontend.

> For the complete Edge Function code and frontend call patterns, see the "Post-generation Usage" section in `references/transcriptions-api.md`.
