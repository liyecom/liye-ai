#!/usr/bin/env python3
"""
卖家精灵内容扩量抓取脚本
目标：80-120 篇，输出到 T2_raw
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re
import json

TARGET_MIN = 80
TARGET_MAX = 120
MAX_PAGES = 15  # 每页约11篇，15页约165篇


def extract_article_body(full_text: str, title: str) -> str:
    lines = full_text.split('\n')

    end_markers = [
        '点赞详情', '全部评论', '最新 (', '最热 (',
        '工作时间：', '邮箱：', '客服：', '市场合作：',
        '版权所有', '蜀ICP备', '川公网安备',
        '成都云雅信息技术有限公司',
        '主人~您还没有收藏的工具'
    ]

    nav_keywords = [
        '中文', '日本語', '首页', '后台', 'AI解读', '产品', '价格',
        '优麦云', '知识库', '快速入门', '视频课堂', '功能手册',
        '运营干货', '客服咨询', '达人招募', '加入我们',
        '精灵知识库', '从这里开启', '活动 HOT', '媒体报道',
        '荣誉奖项', '展会风采', '品牌', '社区', '直播',
        '大数据选品', '关键词优化', '运营推广', '浏览器插件',
        '免费工具', '前往功能手册', '行业资讯', '查看更多',
        '座机', '微信公众号', '扫码', '视频版', '各功能详解',
        '图片来源：卖家精灵', '插件下载', '套餐购买', '常见问题',
        '子账号', '数据更新', '阅读数(', '评论数(',
        '微信扫一扫', '让每一次合作', '关键词转化率',
        'Listing生成器', 'Google Trends', 'Keepa插件',
        '赶快从右侧工具添加吧', '用于快速访问喜爱的工具',
        '028-', '139-', '400-', '186-', '189-'
    ]

    start_idx = -1
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        if any(kw in line for kw in nav_keywords):
            continue
        if len(line) < 15:
            continue
        if re.match(r'^\d{4}/\d{1,2}/\d{1,2}', line):
            continue
        if len(line) > 30 and any(line.startswith(prefix) for prefix in ['对于', '在', '随着', '近年来', '本文', '亚马逊', '作为']):
            start_idx = i
            break

    if start_idx == -1:
        return ""

    article_lines = []
    for i in range(start_idx, len(lines)):
        line = lines[i].strip()
        if any(marker in line for marker in end_markers):
            break
        if not line:
            continue
        if any(kw in line for kw in nav_keywords):
            continue
        if line.startswith('（图片来源'):
            continue
        article_lines.append(line)

    return '\n\n'.join(article_lines)


def fetch_article_content(page, url):
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(2)

        try:
            title = page.locator('h1').first.text_content().strip()
        except:
            title = "未知标题"

        full_text = page.locator('body').inner_text()
        article_body = extract_article_body(full_text, title)

        if len(article_body) < 300:
            return None

        markdown = f"# {title}\n\n{article_body}\n"
        char_count = len(markdown)

        return {
            'title': title,
            'content': markdown,
            'url': url,
            'char_count': char_count
        }

    except Exception as e:
        print(f"   Error: {e}")
        return None


def fetch_article_list(page, start_index=0):
    url = f"https://www.sellersprite.com/cn/blog?startIndex={start_index}"

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_selector('.article', timeout=15000)
        time.sleep(2)

        articles = page.locator('.article').all()
        article_list = []

        for article in articles:
            try:
                title = article.locator('.article-title').text_content().strip()
                link = article.locator('a').first.get_attribute('href')

                if link and link.startswith('/'):
                    link = f"https://www.sellersprite.com{link}"

                article_list.append({
                    'title': title,
                    'url': link
                })
            except:
                continue

        return article_list

    except Exception as e:
        print(f"Error: {e}")
        return []


def save_to_markdown(article, output_dir):
    filename = re.sub(r'[^\w\s-]', '', article['title'])
    filename = re.sub(r'[-\s]+', '-', filename)
    filename = f"{filename[:50]}.md"

    filepath = output_dir / filename

    content = f"""---
source: 卖家精灵
source_url: {article['url']}
fetched_at: {time.strftime('%Y-%m-%d')}
char_count: {article['char_count']}
tier: T2
---

{article['content']}

---

**来源**: [卖家精灵]({article['url']})
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return filepath


def main():
    print(f"[Sellersprite Expanded] Target: {TARGET_MIN}-{TARGET_MAX} articles\n")

    output_dir = Path.home() / 'data/T2_raw/sellersprite'
    output_dir.mkdir(parents=True, exist_ok=True)

    stats = {
        'source': 'sellersprite',
        'total_found': 0,
        'unique_count': 0,
        'success_count': 0,
        'failed_count': 0,
        'total_chars': 0
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            all_articles = []
            seen_urls = set()

            for page_num in range(MAX_PAGES):
                start_index = page_num * 11
                print(f"[Page {page_num + 1}/{MAX_PAGES}] Fetching...")
                articles = fetch_article_list(page, start_index=start_index)

                if not articles:
                    print("   No more articles")
                    break

                for a in articles:
                    if a['url'] not in seen_urls:
                        seen_urls.add(a['url'])
                        all_articles.append(a)

                print(f"   Found {len(articles)}, Total unique: {len(all_articles)}")

                if len(all_articles) >= TARGET_MAX:
                    break

                time.sleep(1)

            stats['total_found'] = len(all_articles)
            all_articles = all_articles[:TARGET_MAX]
            stats['unique_count'] = len(all_articles)

            print(f"\nProcessing {len(all_articles)} articles...\n")

            for i, article in enumerate(all_articles, 1):
                print(f"[{i}/{len(all_articles)}] {article['title'][:40]}...")

                content = fetch_article_content(page, article['url'])

                if content:
                    save_to_markdown(content, output_dir)
                    stats['success_count'] += 1
                    stats['total_chars'] += content['char_count']
                    print(f"   OK ({content['char_count']} chars)")
                else:
                    stats['failed_count'] += 1
                    print(f"   SKIP")

                time.sleep(1.5)

        finally:
            browser.close()

    # Save stats
    stats_file = output_dir / '_stats.json'
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)

    print(f"\n=== Sellersprite Complete ===")
    print(f"Success: {stats['success_count']}")
    print(f"Failed: {stats['failed_count']}")
    print(f"Output: {output_dir}")

    return stats


if __name__ == '__main__':
    main()
