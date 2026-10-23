"""
Truyen24h.vn — Chinese Raw Fiction Crawler & Ingestion Worker
Crawls raw Chinese web novels and pushes them to Truyen24h.vn Translation API.

Usage:
    python crawler.py --url "https://www.69shu.me/txt/XXXXX" --novel-id "tien-nghich" --novel-title "Tiên Nghịch"
    python crawler.py --text-file "raw_chapter1.txt" --novel-id "tien-nghich" --chapter-num 1
"""

import os
import sys
import time
import argparse
import json
import re

try:
    import requests
except ImportError:
    print("Please install requests: pip install requests")
    sys.exit(1)

TRUYEN24H_API_URL = os.environ.get("TRUYEN24H_API_URL", "http://localhost:3001")
ADMIN_API_TOKEN = os.environ.get("ADMIN_API_TOKEN", "b2cce1174a705bed6b62f3dc05576fa8ee1d27bb0dba7cdcdabf9db8355112c9")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

def clean_chinese_text(raw_html_or_text: str) -> str:
    """Strip HTML tags, scripts, and promotional banners."""
    text = re.sub(r'<script.*?</script>', '', raw_html_or_text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</?p.*?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    # Remove common scraper watermarks
    watermarks = [
        r'请收藏本站.*',
        r'最新章节请访问.*',
        r'www\.[a-zA-Z0-9\.]+\.(com|cn|me|net)',
        r'本章未完.*',
    ]
    for wm in watermarks:
        text = re.sub(wm, '', text, flags=re.IGNORECASE)
    
    # Clean multiple spaces and blank lines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return '\n\n'.join(lines)

def push_chapter_to_truyen24h(novel_id: str, chapter_num: int, raw_text: str, novel_title: str = "") -> dict:
    """Send raw Chinese chapter to /api/admin/translate-chapter for AI translation & operator draft."""
    url = f"{TRUYEN24H_API_URL.rstrip('/')}/api/admin/translate-chapter"
    headers = {
        "Content-Type": "application/json",
        "x-admin-token": ADMIN_API_TOKEN,
    }
    payload = {
        "novelId": novel_id,
        "novelTitle": novel_title,
        "chapterNumber": chapter_num,
        "raw": raw_text,
        "persist": False,
    }

    try:
        res = requests.post(url, headers=headers, json=payload, timeout=120)
        if res.status_code == 200:
            data = res.json()
            print(f"✅ [Chương {chapter_num}] Đẩy thành công! Status: {data.get('message', 'OK')}")
            return data
        else:
            print(f"❌ [Chương {chapter_num}] Lỗi API ({res.status_code}): {res.text[:200]}")
            return {"error": res.text, "status": res.status_code}
    except Exception as e:
        print(f"❌ [Chương {chapter_num}] Lỗi kết nối: {e}")
        return {"error": str(e)}

def main():
    parser = argparse.ArgumentParser(description="Truyen24h Chinese Raw Fiction Ingestion")
    parser.add_argument("--novel-id", required=True, help="Slug/ID của truyện trên Truyen24h")
    parser.add_argument("--novel-title", default="", help="Tên truyện")
    parser.add_argument("--chapter-num", type=int, default=1, help="Số thứ tự chương")
    parser.add_argument("--text-file", help="Đường dẫn file txt chứa nội dung raw tiếng Trung")
    parser.add_argument("--raw-text", help="Nội dung chữ Hán trực tiếp")

    args = parser.parse_args()

    content = ""
    if args.text_file and os.path.exists(args.text_file):
        with open(args.text_file, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    elif args.raw_text:
        content = args.raw_text
    else:
        print("Vui lòng cung cấp --text-file hoặc --raw-text")
        sys.exit(1)

    cleaned = clean_chinese_text(content)
    print(f"Đã làm sạch {len(cleaned)} ký tự chữ Hán. Đang đẩy sang Truyen24h...")
    push_chapter_to_truyen24h(args.novel_id, args.chapter_num, cleaned, args.novel_title)

if __name__ == "__main__":
    main()
