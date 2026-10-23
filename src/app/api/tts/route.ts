import { NextRequest, NextResponse } from 'next/server';
import { EdgeTTS } from 'node-edge-tts';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const maxDuration = 60;

// In-memory rate limiting map (IP -> timestamps[])
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 40; // 40 requests/min/IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  validTimestamps.push(now);
  rateLimitMap.set(ip, validTimestamps);
  
  if (rateLimitMap.size > 2000) {
    for (const [key, list] of rateLimitMap.entries()) {
      if (list.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) {
        rateLimitMap.delete(key);
      }
    }
  }
  return true;
}

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau giây lát.' },
        { status: 429 }
      );
    }

    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid text parameter' }, { status: 400 });
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'Text cannot be empty' }, { status: 400 });
    }

    // Protection: Cap text length to 2000 characters per request
    if (trimmed.length > 2000) {
      return NextResponse.json(
        { error: 'Văn bản quá dài (tối đa 2000 ký tự mỗi phân đoạn đọc).' },
        { status: 400 }
      );
    }

    // Configure Node-Edge-TTS
    const tts = new EdgeTTS({
      voice: 'vi-VN-HoaiMyNeural',
      pitch: '+0Hz',
      rate: '+0%',
      volume: '+0%',
    });

    tempFilePath = path.join(os.tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);

    await tts.ttsPromise(trimmed, tempFilePath);
    const audioBuffer = fs.readFileSync(tempFilePath);

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('TTS API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error('Failed to cleanup TTS temp file:', err);
      }
    }
  }
}
