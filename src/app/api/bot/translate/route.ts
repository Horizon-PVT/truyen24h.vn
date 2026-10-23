import { NextRequest, NextResponse } from 'next/server';
import { authorizeBot } from '@/lib/apiAuth';
import { generateAIText } from '@/services/aiProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await authorizeBot(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.reason || 'Unauthorized' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const { text, genre = 'tiên hiệp', title, model } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ ok: false, error: 'Thiếu hoặc sai trường text cần dịch' }, { status: 400 });
    }

    const systemInstruction = `Bạn là một dịch giả tiểu thuyết Trung - Việt hàng đầu chuyên thể loại ${genre}, kiếm hiệp, tiên hiệp, đô thị.
Nhiệm vụ của bạn:
1. Dịch đoạn văn bản tiếng Trung sang tiếng Việt trôi chảy, giàu cảm xúc, giữ đúng văn phong tiểu thuyết mạng Việt Nam.
2. Giữ nguyên các danh xưng Hán-Việt quen thuộc (sư huynh, sư tỷ, chưởng môn, đan điền, linh khí, công pháp, v.v.).
3. Không thêm lời bình, không giải thích ngữ nghĩa, chỉ trả về bản dịch hoàn chỉnh tiếng Việt.`;

    const prompt = title 
      ? `Tiêu đề: ${title}\n\nNội dung cần dịch:\n${text}`
      : `Nội dung cần dịch:\n${text}`;

    const result = await generateAIText({
      prompt,
      systemInstruction,
      temperature: 0.3,
      modelOverride: model,
    });

    return NextResponse.json({
      ok: true,
      translatedText: result.text,
      provider: result.provider,
      model: result.model,
    });
  } catch (error: any) {
    console.error('Bot API translate POST error:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
