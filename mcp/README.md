# Truyen24h - Bot REST API & MCP Server Documentation

Tài liệu hướng dẫn kết nối các Bot tự động (Zalo Bot, Telegram Bot, Hermes Agent, Crawler) và các AI Agent (Claude Desktop, Cursor, Windsurf, Antigravity) vào hệ thống **Truyen24h.vn**.

---

## 1. Xác Thực (Authentication)

Tất cả các yêu cầu từ Bot đều cần truyền mã Token thông qua header:
```http
Authorization: Bearer <ADMIN_API_TOKEN_HOAC_BOT_API_KEY>
```
*Token mặc định được cấu hình trong file `.env.production`: `b2cce117498c460d1a44e59002242142e05930df3200ff41d5b306b9b326aa65`.*

---

## 2. Danh Sách REST API Dành Cho Bot

### A. Lấy danh sách & Tìm kiếm truyện
- **Endpoint**: `GET /api/bot/novels`
- **Query Params**:
  - `q`: Từ khóa tìm kiếm (theo tên truyện hoặc tác giả).
  - `genre`: Thể loại cần lọc (ví dụ: `Tiên Hiệp`, `Kiếm Hiệp`).
  - `limit`: Số lượng kết quả (mặc định 20, tối đa 100).
- **Ví dụ cURL**:
  ```bash
  curl -X GET "https://truyen24h.vn/api/bot/novels?q=dau-pha&limit=10" \
    -H "Authorization: Bearer b2cce117498c460d1a44e59002242142e05930df3200ff41d5b306b9b326aa65"
  ```

---

### B. Đăng truyện mới (Hoặc cập nhật thông tin truyện)
- **Endpoint**: `POST /api/bot/novels`
- **Body JSON**:
  ```json
  {
    "slug": "dau-pha-thuong-khung",
    "title": "Đấu Phá Thương Khung",
    "author": "Thiên Tằm Thổ Đậu",
    "description": "Nơi này là thuộc về Đấu Khí thế giới, không có ma pháp hoa lệ...",
    "genres": ["Tiên Hiệp", "Huyền Huyễn"],
    "coverUrl": "https://example.com/cover.jpg",
    "status": "ongoing",
    "tags": ["Nhiệt Huyết", "Tu Luyện"]
  }
  ```
- **Phản hồi**:
  ```json
  {
    "ok": true,
    "novel": {
      "id": "dau-pha-thuong-khung",
      "slug": "dau-pha-thuong-khung",
      "title": "Đấu Phá Thương Khung",
      "url": "https://truyen24h.vn/truyen/dau-pha-thuong-khung",
      "isCreated": true
    }
  }
  ```

---

### C. Đăng chương mới vào truyện
- **Endpoint**: `POST /api/bot/chapters`
- **Body JSON**:
  ```json
  {
    "novelId": "dau-pha-thuong-khung",
    "chapterNumber": 1,
    "title": "Chương 1: Phế Vật Tiêu Viêm",
    "content": "Gió đêm thổi qua đình viện, thiếu niên ngồi trên mỏm đá...",
    "isVip": false,
    "coinPrice": 0
  }
  ```
- **Phản hồi**:
  ```json
  {
    "ok": true,
    "chapter": {
      "id": "c-1",
      "chapterNumber": 1,
      "title": "Chương 1: Phế Vật Tiêu Viêm",
      "novelId": "dau-pha-thuong-khung",
      "isVip": false,
      "url": "https://truyen24h.vn/doc/dau-pha-thuong-khung/c-1",
      "isCreated": true
    }
  }
  ```

---

### D. Dịch văn bản tiếng Trung sang tiếng Việt bằng BytePlus DeepSeek V4.1
- **Endpoint**: `POST /api/bot/translate`
- **Body JSON**:
  ```json
  {
    "text": "萧炎看着手中的黑色戒指，深深地吸了一口气...",
    "genre": "tiên hiệp",
    "title": "第一章 陨落的天才"
  }
  ```
- **Phản hồi**:
  ```json
  {
    "ok": true,
    "translatedText": "Tiêu Viêm nhìn chiếc nhẫn màu đen trong tay, hít sâu một hơi...",
    "provider": "byteplus",
    "model": "deepseek-v4-1-flash-261017"
  }
  ```

---

### E. Xem thống kê toàn hệ thống
- **Endpoint**: `GET /api/bot/stats`
- **Phản hồi**:
  ```json
  {
    "ok": true,
    "site": {
      "name": "Truyen24h.vn",
      "url": "https://truyen24h.vn",
      "status": "online"
    },
    "stats": {
      "totalNovels": 45,
      "totalChapters": 1280
    },
    "ai": {
      "activeProvider": "byteplus",
      "model": "deepseek-v4-1-flash-261017"
    }
  }
  ```

---

## 3. Cấu Hình MCP Server Cho AI Agents

Truyen24h hỗ trợ chuẩn **Model Context Protocol (MCP)**, cho phép Claude Desktop, Cursor, Windsurf, Hermes Agent hoặc Antigravity tương tác trực tiếp với website như một trợ lý tự động.

### Cấu hình Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "truyen24h": {
      "command": "python",
      "args": [
        "d:/Project/A Tung/truyen24h.vn/truyen24h.vn/mcp/server.py"
      ],
      "env": {
        "TRUYEN24H_BASE_URL": "https://truyen24h.vn",
        "TRUYEN24H_API_TOKEN": "b2cce117498c460d1a44e59002242142e05930df3200ff41d5b306b9b326aa65"
      }
    }
  }
}
```

### Cấu hình Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "truyen24h": {
      "command": "node",
      "args": [
        "d:/Project/A Tung/truyen24h.vn/truyen24h.vn/mcp/server.js"
      ],
      "env": {
        "TRUYEN24H_BASE_URL": "https://truyen24h.vn",
        "TRUYEN24H_API_TOKEN": "b2cce117498c460d1a44e59002242142e05930df3200ff41d5b306b9b326aa65"
      }
    }
  }
}
```

### Kết Nối Cho Hermes Agent (`D:\Hermes-Agent`)
Trong Hermes Agent hoặc bất kỳ bot Python nào, có thể gọi trực tiếp thông qua helper:
```python
import requests

TRUYEN24H_TOKEN = "b2cce117498c460d1a44e59002242142e05930df3200ff41d5b306b9b326aa65"
HEADERS = {"Authorization": f"Bearer {TRUYEN24H_TOKEN}"}

# Đăng chương mới
res = requests.post("https://truyen24h.vn/api/bot/chapters", json={
    "novelId": "dau-pha-thuong-khung",
    "chapterNumber": 2,
    "title": "Chương 2: Đấu Khí Các",
    "content": "Nội dung chương 2...",
    "isVip": False
}, headers=HEADERS)

print(res.json())
```
