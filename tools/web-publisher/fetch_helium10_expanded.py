#!/usr/bin/env python3
"""
Helium 10 扩量抓取脚本
目标：80-120 篇，输出到 T2_raw
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re
import json

TARGET_MIN = 80
TARGET_MAX = 120
MAX_PAGES = 15


def clean_content(text: str) -> str:
    lines = text.split('\n')

    end_markers = [
        'Subscribe', 'Newsletter', 'Related Posts', 'Share this',
        'Leave a comment', 'About the author', 'Get Started',
        'Sign up', 'Free Trial', 'Footer', '© 2025',
        'Privacy Policy', 'Terms of Service', 'All Rights Reserved',
        'Helium 10 Tools', 'Start Your Free Trial'
    ]

    nav_keywords = [
        'Sign in', 'Sign up', 'Get started', 'Free trial',
        'Pricing', 'Tools', 'Resources', 'Solutions',
        'Contact', 'Support', 'Help', 'Academy',
        'Facebook', 'Twitter', 'LinkedIn', 'YouTube',
        'Cookie', 'Accept', 'Decline'
    ]

    start_idx = 0
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if not line_stripped:
            continue
        if len(line_stripped) > 80 and not any(kw in line_stripped for kw in nav_keywords):
            start_idx = i
            break

    content_lines = []
    for i in range(start_idx, len(lines)):
        line = lines[i].strip()

        if any(marker.lower() in line.lower() for marker in end_markers):
            break

        if not line:
            continue

        if any(kw in line for kw in nav_keywords):
            continue

        if len(line) < 15:
            continue

        content_lines.append(line)

    return '\n\n'.join(content_lines)


def fetch_article_content(page, url: str):
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(2)

        try:
            title = page.locator('h1').first.text_content().strip()
        except:
            title = "Unknown Title"

        content = ""
        selectors = ['article', '.post-content', '.entry-content', '.blog-content', 'main article']

        for selector in selectors:
            try:
                element = page.locator(selector).first
                if element.count() > 0:
                    text = element.inner_text()
                    if len(text) > 500:
                        content = text
                        break
            except:
                continue

        if not content:
            content = page.locator('body').inner_text()

        article_body = clean_content(content)

        if len(article_body) < 500:
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


def fetch_article_list(page, page_num: int = 1):
    if page_num == 1:
        url = "https://www.helium10.com/blog/"
    else:
        url = f"https://www.helium10.com/blog/page/{page_num}/"

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(2)

        articles = []
        links = page.locator('a[href*="/blog/"]').all()

        for link in links:
            try:
                href = link.get_attribute('href')
                if not href:
                    continue

                if '/blog/page/' in href or '/blog/category/' in href or '/blog/tag/' in href:
                    continue

                if not re.match(r'https://www\.helium10\.com/blog/[\w-]+/?$', href):
                    continue

                try:
                    title = link.text_content().strip()
                    if len(title) < 10:
                        continue
                except:
                    continue

                if href not in [a['url'] for a in articles]:
                    articles.append({'title': title[:100], 'url': href})
            except:
                continue

        return articles

    except Exception as e:
        print(f"Error: {e}")
        return []


def save_to_markdown(article: dict, output_dir: Path) -> Path:
    filename = re.sub(r'[^\w\s-]', '', article['title'])
    filename = re.sub(r'[-\s]+', '-', filename)
    filename = f"{filename[:60]}.md"

    filepath = output_dir / filename

    content = f"""---
source: Helium 10
source_url: {article['url']}
fetched_at: {time.strftime('%Y-%m-%d')}
char_count: {article['char_count']}
language: en
tier: T2
---

{article['content']}

---

**Source**: [Helium 10]({article['url']})
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return filepath


def main():
    print(f"[Helium 10 Expanded] Target: {TARGET_MIN}-{TARGET_MAX} articles\n")

    output_dir = Path.home() / 'data/T2_raw/helium10'
    output_dir.mkdir(parents=True, exist_ok=True)

    stats = {
        'source': 'helium10',
        'total_found': 0,
        'unique_count': 0,
        'success_count': 0,
        'failed_count': 0,
        'total_chars': 0
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        try:
            all_articles = []
            seen_urls = set()

            for page_num in range(1, MAX_PAGES + 1):
                print(f"[Page {page_num}/{MAX_PAGES}] Fetching...")
                articles = fetch_article_list(page, page_num)

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

    stats_file = output_dir / '_stats.json'
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)

    print(f"\n=== Helium 10 Complete ===")
    print(f"Success: {stats['success_count']}")
    print(f"Failed: {stats['failed_count']}")
    print(f"Output: {output_dir}")

    return stats


if __name__ == '__main__':
    main()
