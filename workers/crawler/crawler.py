"""
Truyen24h.vn — Chinese Raw Fiction Ingestion & AI Pipeline
Crawls raw Chinese web novels, translates them via DeepSeek AI, and publishes to Truyen24h.vn.

Usage:
    python crawler.py --novel-id "vo-than-chua-te" --chapter-num 2 --title-zh "第二章 神秘小剑" --raw-text "..."
    python crawler.py --batch-sample --novel-id "vo-than-chua-te"
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

TRUYEN24H_API_URL = os.environ.get("TRUYEN24H_API_URL", "https://truyen24h.vn")
BOT_API_KEY = os.environ.get("BOT_API_KEY", os.environ.get("ADMIN_API_TOKEN", "b2cce1174a705bed6b62f3dc05576fa8ee1d27bb0dba7cdcdabf9db8355112c9"))

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
    watermarks = [
        r'请收藏本站.*',
        r'最新章节请访问.*',
        r'www\.[a-zA-Z0-9\.]+\.(com|cn|me|net)',
        r'本章未完.*',
    ]
    for wm in watermarks:
        text = re.sub(wm, '', text, flags=re.IGNORECASE)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return '\n\n'.join(lines)

def translate_text(raw_text: str, title: str = "", genre: str = "tiên hiệp") -> str:
    """Call Truyen24h Bot Translate API backed by BytePlus DeepSeek."""
    url = f"{TRUYEN24H_API_URL.rstrip('/')}/api/bot/translate"
    headers = {
        "Content-Type": "application/json",
        "x-bot-token": BOT_API_KEY,
    }
    payload = {
        "text": raw_text,
        "title": title,
        "genre": genre,
    }
    res = requests.post(url, headers=headers, json=payload, timeout=120)
    if res.status_code == 200:
        data = res.json()
        return data.get("translatedText", "")
    else:
        raise Exception(f"Translate failed: {res.status_code} - {res.text[:200]}")

def publish_chapter(novel_id: str, chapter_num: int, title: str, content: str, is_vip: bool = False, price: int = 0) -> dict:
    """Publish translated chapter to Truyen24h."""
    url = f"{TRUYEN24H_API_URL.rstrip('/')}/api/bot/chapters"
    headers = {
        "Content-Type": "application/json",
        "x-bot-token": BOT_API_KEY,
    }
    payload = {
        "novelId": novel_id,
        "chapterNumber": chapter_num,
        "title": title,
        "content": content,
        "isVip": is_vip,
        "coinPrice": price,
    }
    res = requests.post(url, headers=headers, json=payload, timeout=60)
    if res.status_code == 200:
        return res.json()
    else:
        raise Exception(f"Publish failed: {res.status_code} - {res.text[:200]}")

def ingest_chapter(novel_id: str, chapter_num: int, raw_title_zh: str, raw_content_zh: str, is_vip: bool = False):
    print(f"📖 Đang xử lý Chương {chapter_num}: {raw_title_zh}...")
    cleaned = clean_chinese_text(raw_content_zh)
    
    # Dịch tiêu đề
    title_vi = translate_text(raw_title_zh, genre="tiên hiệp").strip()
    if not title_vi.lower().startswith("chương"):
        title_vi = f"Chương {chapter_num}: {title_vi}"
    print(f"   ➔ Tiêu đề tiếng Việt: {title_vi}")

    # Dịch nội dung
    print(f"   ➔ Đang dịch {len(cleaned)} ký tự chữ Hán qua DeepSeek AI...")
    content_vi = translate_text(cleaned, title=title_vi, genre="tiên hiệp")
    print(f"   ➔ Dịch xong {len(content_vi)} ký tự tiếng Việt.")

    # Xuất bản
    price = 50 if is_vip else 0
    print(f"   ➔ Đang xuất bản lên Truyen24h.vn (VIP: {is_vip}, Giá: {price} Xu)...")
    res = publish_chapter(novel_id, chapter_num, title_vi, content_vi, is_vip=is_vip, price=price)
    chap_info = res.get("chapter", {})
    print(f"   ✅ Thành công! Link: {chap_info.get('url')}\n")
    return chap_info

def run_sample_batch(novel_id: str):
    """Nạp mẫu các chương chất lượng cao cho truyện demo."""
    sample_chapters = [
        {
            "num": 2,
            "title_zh": "第二章 绝世药理",
            "is_vip": False,
            "content_zh": """秦尘站在镜子前，看着这具羸弱的躯体，不由苦笑摇头。
“经脉淤塞，血气亏空，连普通武者都不如。不过，既然我秦尘重活一世，纵是凡胎肉体，也定要踏碎凌霄！”
他前世乃是名震天下的第一炼药大师，更被誉为天下第一皇，见识阅历通天彻地。
他闭目思索，脑海中立刻浮现出三千秘法与百种淬体灵液的配方。
“母亲为了保护我，受尽秦家欺凌。三日后的族会大比，我会让那些看不起我们母子的人，全都闭上嘴巴！”
秦尘眼中闪烁着坚毅的光芒，转身推门而出，朝城中的丹阁大步走去。"""
        },
        {
            "num": 3,
            "title_zh": "第三章 震惊丹阁",
            "is_vip": False,
            "content_zh": """大齐国天星城，聚宝阁。
作为城中最大的灵药汇聚之地，此地每日人流如织，无数达官贵人络绎不绝。
秦尘迈步走入大厅，迎面便闻到浓郁的药香。一名药童见秦尘衣着普通，本不欲理睬，但秦尘随手点出柜台上一株‘赤焰草’的五大药效缺陷，语惊四座。
“你说什么？赤焰草与冰心花同炼，不仅药力相克，更会产生剧毒反噬？”
阁楼之上，一名身着三品炼药师袍服的老者快步走下，神色激动万分。
这道药理难题困扰他整整十年，今日竟被一个少年一语道破玄机！
“老夫乃聚宝阁阁主赵灵芝，敢问小友师承何人？”老者深深躬身一礼，眼中满是敬畏。"""
        },
        {
            "num": 4,
            "title_zh": "第四章 淬体灵液，连破三重",
            "is_vip": True,
            "content_zh": """得到聚宝阁奉上的千年灵药后，秦尘回到偏僻小院，当即闭门配置‘玄冥淬体液’。
灵液如翡翠般晶莹剔透，散发着沁人心脾的芬芳。
秦尘脱去衣袍，盘膝跳入滚烫的药桶之中。
轰！
药力宛若千万根钢针同时刺入毛孔，狂暴的热流沿着经脉奔腾肆虐，剧痛足以让任何壮汉昏厥。
然而秦尘紧咬牙关，面不改色，全力运转九星神诀。
咔嚓！
体内桎梏应声碎裂！
凝血一重！凝血二重！凝血三重！
仅仅一夜时间，在惊世神诀的加持下，秦尘连破三境，体内血液隐隐传出雷鸣之音，脱胎换骨！"""
        },
        {
            "num": 5,
            "title_zh": "第五章 族会惊魂，一拳之威",
            "is_vip": True,
            "content_zh": """晨曦初现，秦家族会演武场上人声鼎沸。
擂台中央，秦家第一天才秦奋负手而立，眼神俾睨四方：“秦尘那个废物呢？今日若不上台认输，就按照族规逐出家门！”
看台上，大长老等人神色漠然，嘴角挂着冷笑。
“谁说我不敢来？”
一道清冷的声音骤然自广场入口响起。
人群如潮水般分开，只见秦尘白衣胜雪，步履沉稳地走上战台。
“找死！”秦奋勃然大怒，暴起一掌，狂暴的掌风夹杂着虎啸之声轰然砸下！
秦尘神色自若，直到掌风临体半尺之距，方才轻描淡写地抬手轰出一拳！
砰！
虚空中爆发出刺耳的气爆声，秦奋狂喷鲜血倒飞数十米，狠狠砸碎精钢石柱！
全场死寂！"""
        }
    ]

    print(f"🚀 Bắt đầu nạp tự động {len(sample_chapters)} chương mẫu cho truyện '{novel_id}'...\n")
    for chap in sample_chapters:
        ingest_chapter(novel_id, chap["num"], chap["title_zh"], chap["content_zh"], is_vip=chap["is_vip"])
        time.sleep(1) # Giãn cách nhẹ nhàng
    print("🎉 Hoàn tất nạp dữ liệu! Kiểm tra lại trên website.")

def main():
    parser = argparse.ArgumentParser(description="Truyen24h Chinese Raw Fiction Ingestion & AI Pipeline")
    parser.add_argument("--novel-id", required=True, help="Slug/ID của truyện trên Truyen24h")
    parser.add_argument("--chapter-num", type=int, default=1, help="Số thứ tự chương")
    parser.add_argument("--title-zh", default="", help="Tiêu đề tiếng Trung")
    parser.add_argument("--raw-text", help="Nội dung chữ Hán trực tiếp")
    parser.add_argument("--is-vip", action="store_true", help="Đánh dấu chương VIP")
    parser.add_argument("--batch-sample", action="store_true", help="Chạy nạp thử nghiệm loạt chương liên hoàn")

    args = parser.parse_args()

    if args.batch_sample:
        run_sample_batch(args.novel_id)
        return

    if not args.raw_text:
        print("Vui lòng cung cấp --raw-text hoặc --batch-sample")
        sys.exit(1)

    ingest_chapter(args.novel_id, args.chapter_num, args.title_zh or f"第{args.chapter_num}章", args.raw_text, is_vip=args.is_vip)

if __name__ == "__main__":
    main()
