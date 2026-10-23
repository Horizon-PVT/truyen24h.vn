#!/usr/bin/env node
/**
 * Truyen24h Model Context Protocol (MCP) Server (Node.js)
 * Standalone, zero-dependency MCP server for Claude Desktop, Cursor, Windsurf, etc.
 *
 * Usage:
 *   node mcp/server.js
 */

const readline = require('readline');

const BASE_URL = (process.env.TRUYEN24H_BASE_URL || 'https://truyen24h.vn').replace(/\/$/, '');
const API_TOKEN = process.env.TRUYEN24H_API_TOKEN || 'b2cce117498c460d1a44e59002242142e05930df3200ff41d5b306b9b326aa65';

async function makeApiRequest(path, method = 'GET', body = null) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    Authorization: `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Truyen24h-MCP-Node/1.0',
  };

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error || `HTTP ${res.status}` };
    }
    return data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const TOOLS = [
  {
    name: 'truyen24h_list_novels',
    description: 'Lấy danh sách hoặc tìm kiếm truyện trên Truyen24h.vn theo từ khóa hoặc thể loại.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Từ khóa tìm kiếm theo tên truyện hoặc tác giả' },
        genre: { type: 'string', description: 'Lọc theo thể loại (ví dụ: Tiên Hiệp, Kiếm Hiệp, Đô Thị)' },
        limit: { type: 'integer', description: 'Số lượng truyện cần lấy (tối đa 100)', default: 20 },
      },
    },
  },
  {
    name: 'truyen24h_publish_novel',
    description: 'Đăng một bộ truyện mới hoặc cập nhật thông tin truyện trên Truyen24h.vn.',
    inputSchema: {
      type: 'object',
      required: ['title', 'author', 'description'],
      properties: {
        title: { type: 'string', description: 'Tên truyện' },
        author: { type: 'string', description: 'Tên tác giả' },
        description: { type: 'string', description: 'Mô tả / tóm tắt cốt truyện' },
        genres: { type: 'array', items: { type: 'string' }, description: 'Danh sách thể loại' },
        coverUrl: { type: 'string', description: 'Link ảnh bìa' },
        slug: { type: 'string', description: 'Đường dẫn tùy chỉnh (slug) nếu muốn chỉ định' },
        status: { type: 'string', enum: ['ongoing', 'completed'], default: 'ongoing', description: 'Trạng thái truyện' },
      },
    },
  },
  {
    name: 'truyen24h_publish_chapter',
    description: 'Đăng một chương mới vào bộ truyện trên Truyen24h.vn.',
    inputSchema: {
      type: 'object',
      required: ['novelId', 'chapterNumber', 'title', 'content'],
      properties: {
        novelId: { type: 'string', description: 'ID hoặc slug của bộ truyện (ví dụ: dau-pha-thuong-khung)' },
        chapterNumber: { type: 'integer', description: 'Số thứ tự chương (ví dụ: 1, 2, 3...)' },
        title: { type: 'string', description: 'Tiêu đề chương (ví dụ: Chương 1: Thiên Tài Biến Phế Vật)' },
        content: { type: 'string', description: 'Nội dung văn bản đầy đủ của chương' },
        isVip: { type: 'boolean', default: false, description: 'Chương có thu phí VIP hay không' },
        coinPrice: { type: 'integer', default: 0, description: 'Giá xu nếu là chương VIP (ví dụ: 10, 20 xu)' },
      },
    },
  },
  {
    name: 'truyen24h_translate_text',
    description: 'Dịch văn bản hoặc chương truyện tiếng Trung sang tiếng Việt văn phong kiếm hiệp/tiên hiệp bằng cụm AI BytePlus DeepSeek V4.1.',
    inputSchema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string', description: 'Đoạn văn bản hoặc toàn bộ chương truyện tiếng Trung cần dịch' },
        genre: { type: 'string', default: 'tiên hiệp', description: 'Thể loại để định hình văn phong' },
        title: { type: 'string', description: 'Tiêu đề chương tiếng Trung (nếu có)' },
      },
    },
  },
  {
    name: 'truyen24h_get_stats',
    description: 'Lấy thông số thống kê tổng thể của website Truyen24h.vn.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function handleCallTool(name, args) {
  if (name === 'truyen24h_list_novels') {
    const params = new URLSearchParams();
    if (args.q) params.set('q', args.q);
    if (args.genre) params.set('genre', args.genre);
    if (args.limit) params.set('limit', String(args.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return await makeApiRequest(`/api/bot/novels${qs}`, 'GET');
  }

  if (name === 'truyen24h_publish_novel') {
    return await makeApiRequest('/api/bot/novels', 'POST', args);
  }

  if (name === 'truyen24h_publish_chapter') {
    return await makeApiRequest('/api/bot/chapters', 'POST', args);
  }

  if (name === 'truyen24h_translate_text') {
    return await makeApiRequest('/api/bot/translate', 'POST', args);
  }

  if (name === 'truyen24h_get_stats') {
    return await makeApiRequest('/api/bot/stats', 'GET');
  }

  return { ok: false, error: `Tool ${name} not found` };
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const msg = JSON.parse(trimmed);
    const { id, method, params } = msg;

    if (method === 'initialize') {
      const resp = {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'truyen24h-mcp-server', version: '1.0.0' },
        },
      };
      process.stdout.write(JSON.stringify(resp) + '\n');
      return;
    }

    if (method === 'notifications/initialized') {
      return;
    }

    if (method === 'tools/list') {
      const resp = {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      };
      process.stdout.write(JSON.stringify(resp) + '\n');
      return;
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const result = await handleCallTool(toolName, toolArgs);

      const resp = {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
      process.stdout.write(JSON.stringify(resp) + '\n');
      return;
    }

    if (id !== undefined) {
      const resp = {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method ${method} not found` },
      };
      process.stdout.write(JSON.stringify(resp) + '\n');
    }
  } catch (err) {
    const resp = {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: err.message },
    };
    process.stdout.write(JSON.stringify(resp) + '\n');
  }
});
