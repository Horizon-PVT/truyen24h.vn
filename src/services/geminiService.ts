import { Novel } from '../types';

const recCache = new Map<string, string[]>();
const summaryCache = new Map<string, string>();
const greetingCache = new Map<string, string>();

export async function getAIRecommendations(currentNovel: Novel, allNovels: Novel[] = []): Promise<Novel[]> {
  const fallback = allNovels.filter((novel) =>
    novel.id !== currentNovel.id &&
    (novel.genres || []).some((genre) => (currentNovel.genres || []).includes(genre))
  ).slice(0, 3);

  if (recCache.has(currentNovel.id)) {
    const ids = recCache.get(currentNovel.id) || [];
    return allNovels.filter((novel) => ids.includes(novel.id));
  }

  recCache.set(currentNovel.id, fallback.map((novel) => novel.id));
  return fallback;
}

export async function getDailyGreeting(userName: string): Promise<string> {
  const fallback = `Chào mừng trở lại, ${userName}! Chúc bạn đọc truyện vui vẻ.`;
  if (greetingCache.has(userName)) return greetingCache.get(userName)!;
  greetingCache.set(userName, fallback);
  return fallback;
}

export async function getNovelSummary(novel: Novel): Promise<string> {
  const fallback = `${novel.description.slice(0, 150)}...`;
  if (summaryCache.has(novel.id)) return summaryCache.get(novel.id)!;
  summaryCache.set(novel.id, fallback);
  return fallback;
}
