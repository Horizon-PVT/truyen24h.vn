/**
 * Unified AI Provider Service
 *
 * Supports multi-model switching between:
 *   1. Google Gemini (@google/genai)
 *   2. DeepSeek (DeepSeek-V3 / DeepSeek-R1) via OpenAI-compatible API
 *   3. SiliconFlow (Qwen 2.5 / DeepSeek) via OpenAI-compatible API
 *
 * Configured via environment variables:
 *   AI_PROVIDER = 'gemini' | 'deepseek' | 'siliconflow' (default: 'gemini')
 *   DEEPSEEK_API_KEY = 'sk-...'
 *   SILICONFLOW_API_KEY = 'sk-...'
 */

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  modelOverride?: string;
}

export interface GenerateTextResult {
  text: string;
  provider: string;
  model: string;
}

export function getActiveProvider(): 'gemini' | 'deepseek' | 'siliconflow' {
  const p = (process.env.AI_PROVIDER || '').toLowerCase().trim();
  if (p === 'deepseek' || p === 'siliconflow') return p;
  return 'gemini';
}

/**
 * Standard OpenAI-compatible API caller (native fetch, zero extra dependencies).
 */
async function callOpenAICompatible(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const messages: { role: string; content: string }[] = [];

  if (opts.systemInstruction) {
    messages.push({ role: 'system', content: opts.systemInstruction });
  }

  messages.push({ role: 'user', content: opts.prompt });

  const body: Record<string, any> = {
    model: opts.model,
    messages,
    temperature: opts.temperature ?? 0.7,
  };

  if (opts.maxTokens) {
    body.max_tokens = opts.maxTokens;
  }

  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const endpoint = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI Provider HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content || '';
  return content.trim();
}

/**
 * Primary text generation dispatcher.
 */
export async function generateAIText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const provider = getActiveProvider();

  // 1. DeepSeek Provider
  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not set in environment.');
    }
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    const model = options.modelOverride || 'deepseek-chat';
    const text = await callOpenAICompatible({
      baseUrl,
      apiKey,
      model,
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
    });
    return { text, provider: 'deepseek', model };
  }

  // 2. SiliconFlow Provider (Qwen 2.5 / DeepSeek)
  if (provider === 'siliconflow') {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      throw new Error('SILICONFLOW_API_KEY is not set in environment.');
    }
    const baseUrl = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
    const model = options.modelOverride || 'deepseek-ai/DeepSeek-V3';
    const text = await callOpenAICompatible({
      baseUrl,
      apiKey,
      model,
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
    });
    return { text, provider: 'siliconflow', model };
  }

  // 3. Google Gemini Provider (Default)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment.');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const model = options.modelOverride || 'gemini-2.5-flash';

  const config: Record<string, any> = {};
  if (options.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }
  if (options.temperature !== undefined) {
    config.temperature = options.temperature;
  }
  if (options.jsonMode) {
    config.responseMimeType = 'application/json';
  }

  const response = await ai.models.generateContent({
    model,
    contents: options.prompt,
    config,
  });

  return {
    text: (response.text || '').trim(),
    provider: 'gemini',
    model,
  };
}
