/**
 * AI Story Generation Service
 *
 * Powers the "daily admin" pipeline: brainstorm story ideas, generate full
 * novel metadata, write chapters that hook readers, and produce SEO-friendly
 * summaries. Designed to run on Vercel/Node server routes.
 *
 * Backed by generateAIText (BytePlus ModelArk DeepSeek / Gemini / OpenRouter).
 */
import { GENRES } from '../constants';
import { LorebookEntry } from '../types';
import { generateAIText } from './aiProvider';

export interface GeneratedNovel {
  title: string;
  author: string; // "AI Studio" or persona name
  description: string;
  genres: string[];
  status: 'Đang ra' | 'Hoàn thành';
  hook: string; // 1-line marketing hook for social
  tags: string[]; // long-tail SEO tags
  coverPrompt: string; // image prompt for cover gen
}

export interface GeneratedChapter {
  title: string;
  content: string;
  wordCount: number;
  cliffhanger: string;
}

export interface TrendingTopic {
  topic: string;
  reasoning: string;
  suggestedGenres: string[];
}

function cleanJson(text: string): string {
  return text.replace(/^```json\s*|^```\s*|```$/g, '').trim();
}

/* ---------------- 1. Topic discovery ---------------- */

/**
 * Brainstorm 3-5 hot fiction topics that resonate with Vietnamese readers
 * right now. Useful as input to generateNovelOutline.
 */
export async function discoverTrendingTopics(opts: {
  count?: number;
  excludeRecent?: string[];
}): Promise<TrendingTopic[]> {
  const { count = 5, excludeRecent = [] } = opts;

  const prompt = `Bạn là chuyên gia content cho 1 trang đọc truyện chữ tiếng Việt
(audience: nữ 18-35, nam 18-35, đọc trên di động, thích trùng sinh / ngôn tình / hệ thống / đô thị / tiên hiệp).
Hãy đề xuất ${count} chủ đề truyện đang HOT trong tháng này theo TikTok và Google Trends VN.

Các chủ đề KHÔNG được trùng với danh sách đã có:
${excludeRecent.map((t) => `- ${t}`).join('\n') || '(không có)'}

Yêu cầu mỗi chủ đề:
- Tiêu đề ý tưởng đặc sắc 1 dòng
- Lý do hot (vì sao reader muốn đọc lúc này)
- 2-3 thể loại phù hợp từ list: ${GENRES.slice(0, 30).join(', ')}...
Tránh các chủ đề chung chung; ưu tiên hook cảm xúc mạnh (ngược tâm, báo thù, sủng ngọt, cẩu huyết, trang bức vả mặt).

BẮT BUỘC trả lời DUY NHẤT một khối JSON hợp lệ theo format:
{
  "topics": [
    {
      "topic": "tiêu đề ý tưởng",
      "reasoning": "lý do hot",
      "suggestedGenres": ["Ngôn Tình", "Trọng Sinh"]
    }
  ]
}`;

  const res = await generateAIText({
    prompt,
    jsonMode: true,
  });

  try {
    const rawJson = cleanJson(res.text);
    const data = JSON.parse(rawJson);
    return (data.topics || []) as TrendingTopic[];
  } catch (err) {
    console.error('Failed to parse discoverTrendingTopics JSON:', res.text, err);
    return [
      {
        topic: 'Cô vợ phế vật trùng sinh báo thù giới thượng lưu',
        reasoning: 'Trend vả mặt báo thù cực hot trên TikTok',
        suggestedGenres: ['Ngôn Tình', 'Trọng Sinh', 'Đô Thị'],
      },
      {
        topic: 'Vô Địch Kiếm Đế: Trọng sinh từ một gia nô nhỏ bé',
        reasoning: 'Motif nghịch tập tu tiên thịnh hành nhất',
        suggestedGenres: ['Tiên Hiệp', 'Huyền Huyễn', 'Trọng Sinh'],
      },
    ];
  }
}

/* ---------------- 2. Novel outline ---------------- */

export async function generateNovelOutline(opts: {
  topic: string;
  genres?: string[];
  toneHints?: string;
}): Promise<GeneratedNovel> {
  const { topic, genres = [], toneHints = 'sủng ngọt, có twist ngược nhẹ' } = opts;

  const prompt = `Bạn là tác giả truyện chữ tiếng Việt cực ăn khách trên các nền tảng như Truyen24h, Metruyenchu.
Hãy phát triển ý tưởng sau thành 1 bộ truyện mới có thể đăng dài 50-100 chương:

Ý tưởng: ${topic}
Thể loại gợi ý: ${genres.join(', ') || '(tự chọn)'}
Tone: ${toneHints}

YÊU CẦU ĐẦU RA BẮT BUỘC: Trả DUY NHẤT một khối JSON hợp lệ theo cấu trúc:
{
  "title": "tiêu đề cuốn hút 5-12 chữ, dễ nhớ",
  "author": "tên bút danh thuần Việt (vd: Nguyệt Cầm, Phong Linh, Ám Dạ), TUYỆT ĐỐI KHÔNG dùng từ AI",
  "description": "mô tả tóm tắt truyện 4-6 câu, có hook mạnh ở câu đầu, kết bằng lời kêu gọi đọc",
  "genres": ["thể loại 1", "thể loại 2"],
  "status": "Đang ra",
  "hook": "1 câu marketing dưới 25 chữ cho TikTok/Facebook",
  "tags": ["tag seo 1", "tag seo 2", "tag seo 3"],
  "coverPrompt": "1 đoạn mô tả tiếng Anh chi tiết để vẽ ảnh bìa phong cách anime/digital painting, ánh sáng, góc máy"
}`;

  const res = await generateAIText({
    prompt,
    jsonMode: true,
  });

  const rawJson = cleanJson(res.text);
  const out = JSON.parse(rawJson || '{}') as GeneratedNovel;
  out.genres = (out.genres || []).filter((g) => GENRES.includes(g));
  if (out.genres.length === 0 && genres.length) out.genres = genres.slice(0, 3);
  if (out.genres.length === 0) out.genres = ['Huyền Huyễn', 'Trọng Sinh'];
  out.status = 'Đang ra';
  return out;
}

/* ---------------- 3. Chapter generation ---------------- */

export function extractRelevantLore(
  textToScan: string,
  lorebook: LorebookEntry[] = []
): LorebookEntry[] {
  if (!lorebook.length || !textToScan) return [];
  const lower = textToScan.toLowerCase();
  return lorebook.filter((entry) => {
    return (
      (entry.keywords || []).some((kw) => lower.includes(kw.toLowerCase())) ||
      lower.includes(entry.name.toLowerCase())
    );
  }).slice(0, 8);
}

export async function generateChapter(opts: {
  novelTitle: string;
  novelDescription: string;
  genres: string[];
  chapterNumber: number;
  previousSummary?: string;
  targetWordCount?: number;
  worldSetting?: string;
  lorebook?: LorebookEntry[];
}): Promise<GeneratedChapter> {
  const {
    novelTitle,
    novelDescription,
    genres,
    chapterNumber,
    previousSummary = '',
    targetWordCount = 1800,
    worldSetting = '',
    lorebook = [],
  } = opts;

  const relevantLore = extractRelevantLore(`${novelDescription} ${previousSummary}`, lorebook);
  const lorePrompt = relevantLore.length > 0
    ? `\n[HỒ SƠ BỐI CẢNH & NHÂN VẬT THỰC THỂ (LOREBOOK)]:\n${relevantLore.map((l) => `- [${l.category.toUpperCase()}] ${l.name}: ${l.description} (Trạng thái: ${l.status || 'Bình thường'})`).join('\n')}\n`
    : '';

  const prompt = `Bạn là tác giả truyện chữ tiếng Việt chuyên nghiệp.
Bộ truyện: "${novelTitle}"
Thể loại: ${genres.join(', ')}
Tóm tắt cốt truyện: ${novelDescription}
${worldSetting ? `Bối cảnh thế giới / Cấp bậc sức mạnh:\n${worldSetting}\n` : ''}
${previousSummary ? `Tóm tắt diễn biến chương trước:\n${previousSummary}\n` : ''}
${lorePrompt}
Hãy viết Chương ${chapterNumber}, độ dài KHOẢNG ${targetWordCount} chữ tiếng Việt.

Quy tắc bắt buộc:
1. Viết 100% tiếng Việt tự nhiên, văn phong mượt mà, câu chữ phong phú, giữ đúng logic nhân vật theo Lorebook.
2. Chia đoạn dày, mỗi đoạn 2-5 câu. KHÔNG khối văn dài 20 câu.
3. Bắt đầu bằng hook giữa hành động hoặc đối thoại, không miêu tả lê thê.
4. Kết chương bằng 1 CLIFFHANGER kích thích đọc tiếp (twist nhỏ, câu hỏi treo, lựa chọn đột ngột).
5. KHÔNG nhắc tên người dùng/AI/Gemini/DeepSeek.
6. KHÔNG xen chú thích.

BẮT BUỘC trả JSON với format:
{
  "title": "tiêu đề chương (5-10 chữ, không cần prefix Chương X)",
  "content": "toàn bộ nội dung chương văn bản tiếng Việt dài với nhiều đoạn cách nhau bởi \\n\\n",
  "cliffhanger": "1 câu tóm tắt nút thắt hồi hộp cuối chương"
}`;

  const res = await generateAIText({
    prompt,
    jsonMode: true,
  });

  const rawJson = cleanJson(res.text);
  const out = JSON.parse(rawJson) as Omit<GeneratedChapter, 'wordCount'>;
  const wordCount = out.content ? out.content.trim().split(/\s+/).length : 0;
  return { ...out, wordCount };
}

/* ---------------- 4. SEO blog snippet ---------------- */

export async function generateSeoBlurb(opts: { novelTitle: string; genres: string[]; description: string }): Promise<string> {
  const prompt = `Viết đoạn giới thiệu SEO 80-120 từ cho truyện "${opts.novelTitle}" thể loại ${opts.genres.join(', ')}.
Đoạn này dùng ở đầu trang truyện. Nhồi tự nhiên 2-3 keyword chính (vd: "đọc truyện ${opts.genres[0]?.toLowerCase()} hay 2026").
Văn phong nói thẳng, không sáo rỗng, có 1 câu CTA cuối kêu gọi đọc miễn phí.

Mô tả truyện: ${opts.description}`;

  const res = await generateAIText({ prompt });
  return (res.text || '').trim();
}

/* ---------------- 5. Cover image prompt (used by /api/ai/generate-cover) ---------------- */

export function buildCoverImagePrompt(novel: GeneratedNovel): string {
  return [
    novel.coverPrompt,
    'high quality book cover illustration',
    'centered composition, soft lighting',
    'no text, no watermark, no logos',
    `mood inspired by genres: ${novel.genres.join(', ')}`,
  ].join(', ');
}

export const AI_SERVICE_READY = true;
