/**
 * AI Translation service (Chinese → Vietnamese).
 *
 * Uses Gemini for both translation and on-the-fly chapter splitting.
 * Designed for converted-novel workflow ("convert truyện Tàu"):
 *   - admin pastes the original Chinese text in one go
 *   - we split it into chapters by detecting "第\d+章" / "Chương \d+"
 *     markers OR by paragraph count fallback
 *   - each chunk goes through translate() which produces idiomatic
 *     Vietnamese (not literal MT) with proper diacritics
 *
 * All functions throw if GEMINI_API_KEY isn't set, so callers
 * surface a friendly error.
 */
import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
const MODEL = 'gemini-2.5-flash';

function ensureAi(): GoogleGenAI {
  if (!ai) throw new Error('Gemini API key chưa cấu hình.');
  return ai;
}

/* ---------- Chapter detection ---------- */

const CN_CHAPTER_RE = /^[\s]*第\s*[0-9一二三四五六七八九十百千万零〇]+\s*章/gm;
const VN_CHAPTER_RE = /^[\s]*Ch[uươ]ng\s*\d+/gim;

export function splitIntoChapters(input: string, hintPerChapter = 2500): string[] {
  // Try chapter markers first.
  const markerMatches: number[] = [];
  let m: RegExpExecArray | null;
  CN_CHAPTER_RE.lastIndex = 0;
  while ((m = CN_CHAPTER_RE.exec(input)) !== null) markerMatches.push(m.index);
  if (markerMatches.length < 2) {
    VN_CHAPTER_RE.lastIndex = 0;
    while ((m = VN_CHAPTER_RE.exec(input)) !== null) markerMatches.push(m.index);
  }
  if (markerMatches.length >= 2) {
    const chunks: string[] = [];
    for (let i = 0; i < markerMatches.length; i++) {
      const start = markerMatches[i];
      const end = i + 1 < markerMatches.length ? markerMatches[i + 1] : input.length;
      chunks.push(input.slice(start, end).trim());
    }
    return chunks;
  }
  // Fallback: split by character count
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += hintPerChapter) {
    chunks.push(input.slice(i, i + hintPerChapter).trim());
  }
  return chunks.filter(Boolean);
}

/* ---------- Translate one chapter ---------- */

export interface TranslatedChapter {
  title: string;
  content: string;
}

export async function translateChapter(opts: {
  raw: string;
  chapterNumber: number;
  novelTitle?: string;
  glossary?: Record<string, string>;
}): Promise<TranslatedChapter> {
  ensureAi();
  const glossaryLines = opts.glossary
    ? Object.entries(opts.glossary).map(([cn, vn]) => `${cn} = ${vn}`).join('\n')
    : '';

  const prompt = `Bạn là dịch giả chuyên truyện chữ Trung Quốc → Việt Nam, văn phong mượt mà như Phỉ Ngã Tư Tồn / Đường Gia Tam Thiếu.
${opts.novelTitle ? `Bộ truyện: "${opts.novelTitle}"` : ''}

Cần dịch Chương ${opts.chapterNumber} dưới đây sang tiếng Việt:

${opts.raw.slice(0, 14000)}

YÊU CẦU bắt buộc:
- Dịch ý chứ không dịch máy. Văn phong tự nhiên, đối thoại rõ.
- Giữ tên riêng theo phiên âm Hán-Việt (Vd: 林晚 → Lâm Vãn, không phải Lin Wan).
- Mỗi đoạn 2-5 câu, có xuống dòng.
- Tách rõ đối thoại bằng dấu — đầu dòng hoặc dấu "...".
- KHÔNG để chữ Hán còn sót.
${glossaryLines ? `\nDanh sách thuật ngữ ưu tiên:\n${glossaryLines}\n` : ''}

Trả JSON:
- title: tiêu đề chương 5-12 chữ tiếng Việt (chỉ tên, không "Chương X")
- content: toàn bộ chương đã dịch (markdown plain với \\n\\n giữa đoạn)`;

  const response = await ai!.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
        },
        required: ['title', 'content'],
      },
    },
  });
  return JSON.parse(response.text || '{}') as TranslatedChapter;
}
