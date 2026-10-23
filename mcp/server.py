#!/usr/bin/env python3
"""
Truyen24h Model Context Protocol (MCP) Server
Allows AI Agents (Claude Desktop, Cursor, Hermes Agent, Antigravity) to manage novels,
publish chapters, and translate raw text directly on Truyen24h.vn.

Usage:
  python mcp/server.py

Environment Variables:
  TRUYEN24H_BASE_URL: (default: https://truyen24h.vn)
  TRUYEN24H_API_TOKEN: Your ADMIN_API_TOKEN or BOT_API_KEY
"""

import sys
import json
import os
import urllib.request
import urllib.error

BASE_URL = os.environ.get("TRUYEN24H_BASE_URL", "https://truyen24h.vn").rstrip("/")
API_TOKEN = os.environ.get("TRUYEN24H_API_TOKEN", "b2cce117498c460d1a44e59002242142e05930df3200ff41d5b306b9b326aa65")

def make_api_request(path: str, method: str = "GET", data: dict = None) -> dict:
    url = f"{BASE_URL}{path}"
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
        "User-Agent": "Truyen24h-MCP-Server/1.0"
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        return {"ok": False, "error": f"HTTP {e.code}: {err_msg}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

TOOLS = [
    {
        "name": "truyen24h_list_novels",
        "description": "Lấy danh sách hoặc tìm kiếm truyện trên Truyen24h.vn theo từ khóa hoặc thể loại.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "q": {"type": "string", "description": "Từ khóa tìm kiếm theo tên truyện hoặc tác giả"},
                "genre": {"type": "string", "description": "Lọc theo thể loại (ví dụ: Tiên Hiệp, Kiếm Hiệp, Đô Thị)"},
                "limit": {"type": "integer", "description": "Số lượng truyện cần lấy (tối đa 100)", "default": 20}
            }
        }
    },
    {
        "name": "truyen24h_publish_novel",
        "description": "Đăng một bộ truyện mới hoặc cập nhật thông tin truyện trên Truyen24h.vn.",
        "inputSchema": {
            "type": "object",
            "required": ["title", "author", "description"],
            "properties": {
                "title": {"type": "string", "description": "Tên truyện"},
                "author": {"type": "string", "description": "Tên tác giả"},
                "description": {"type": "string", "description": "Mô tả / tóm tắt cốt truyện"},
                "genres": {"type": "array", "items": {"type": "string"}, "description": "Danh sách thể loại"},
                "coverUrl": {"type": "string", "description": "Link ảnh bìa"},
                "slug": {"type": "string", "description": "Đường dẫn tùy chỉnh (slug) nếu muốn chỉ định"},
                "status": {"type": "string", "enum": ["ongoing", "completed"], "default": "ongoing", "description": "Trạng thái truyện"}
            }
        }
    },
    {
        "name": "truyen24h_publish_chapter",
        "description": "Đăng một chương mới vào bộ truyện trên Truyen24h.vn.",
        "inputSchema": {
            "type": "object",
            "required": ["novelId", "chapterNumber", "title", "content"],
            "properties": {
                "novelId": {"type": "string", "description": "ID hoặc slug của bộ truyện (ví dụ: dau-pha-thuong-khung)"},
                "chapterNumber": {"type": "integer", "description": "Số thứ tự chương (ví dụ: 1, 2, 3...)"},
                "title": {"type": "string", "description": "Tiêu đề chương (ví dụ: Chương 1: Thiên Tài Biến Phế Vật)"},
                "content": {"type": "string", "description": "Nội dung văn bản đầy đủ của chương"},
                "isVip": {"type": "boolean", "default": False, "description": "Chương có thu phí VIP hay không"},
                "coinPrice": {"type": "integer", "default": 0, "description": "Giá xu nếu là chương VIP (ví dụ: 10, 20 xu)"}
            }
        }
    },
    {
        "name": "truyen24h_translate_text",
        "description": "Dịch văn bản hoặc chương truyện tiếng Trung sang tiếng Việt văn phong kiếm hiệp/tiên hiệp mượt mà bằng cụm AI BytePlus DeepSeek V4.1.",
        "inputSchema": {
            "type": "object",
            "required": ["text"],
            "properties": {
                "text": {"type": "string", "description": "Đoạn văn bản hoặc toàn bộ chương truyện tiếng Trung cần dịch"},
                "genre": {"type": "string", "default": "tiên hiệp", "description": "Thể loại để định hình văn phong (tiên hiệp, kiếm hiệp, đô thị...)"},
                "title": {"type": "string", "description": "Tiêu đề chương tiếng Trung (nếu có)"}
            }
        }
    },
    {
        "name": "truyen24h_get_stats",
        "description": "Lấy thông số thống kê tổng thể của website Truyen24h.vn (tổng số truyện, tổng số chương, mô hình AI đang chạy).",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    }
]

def handle_call_tool(name: str, arguments: dict) -> dict:
    if name == "truyen24h_list_novels":
        params = []
        if arguments.get("q"):
            params.append(f"q={urllib.parse.quote(str(arguments['q']))}")
        if arguments.get("genre"):
            params.append(f"genre={urllib.parse.quote(str(arguments['genre']))}")
        if arguments.get("limit"):
            params.append(f"limit={arguments['limit']}")
        query_str = f"?{'&'.join(params)}" if params else ""
        return make_api_request(f"/api/bot/novels{query_str}", method="GET")

    elif name == "truyen24h_publish_novel":
        return make_api_request("/api/bot/novels", method="POST", data=arguments)

    elif name == "truyen24h_publish_chapter":
        return make_api_request("/api/bot/chapters", method="POST", data=arguments)

    elif name == "truyen24h_translate_text":
        return make_api_request("/api/bot/translate", method="POST", data=arguments)

    elif name == "truyen24h_get_stats":
        return make_api_request("/api/bot/stats", method="GET")

    else:
        return {"ok": False, "error": f"Tool '{name}' không tồn tại."}

def main():
    import urllib.parse
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue

            msg = json.loads(line)
            msg_id = msg.get("id")
            method = msg.get("method")

            if method == "initialize":
                resp = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {}
                        },
                        "serverInfo": {
                            "name": "truyen24h-mcp-server",
                            "version": "1.0.0"
                        }
                    }
                }
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()

            elif method == "notifications/initialized":
                pass

            elif method == "tools/list":
                resp = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "tools": TOOLS
                    }
                }
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()

            elif method == "tools/call":
                params = msg.get("params", {})
                tool_name = params.get("name")
                arguments = params.get("arguments", {})

                result_data = handle_call_tool(tool_name, arguments)
                resp = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(result_data, ensure_ascii=False, indent=2)
                            }
                        ]
                    }
                }
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()

            elif msg_id is not None:
                # Unknown method response
                resp = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method {method} not found"
                    }
                }
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()

        except Exception as e:
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
