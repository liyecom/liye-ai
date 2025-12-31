#!/usr/bin/env python3
"""
Reddit r/FulfillmentByAmazon 扩量抓取脚本
目标：80-120 篇，输出到 T2_raw
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re
import json

TARGET_MIN = 80
TARGET_MAX = 120


def extract_post_content(page) -> str:
    content_parts = []

    try:
        selftext = page.locator('.expando .usertext-body').first
        if selftext.count() > 0:
            text = selftext.inner_text()
            if text and len(text) > 50:
                content_parts.append(text)
    except:
        pass

    try:
        comments = page.locator('.comment .usertext-body').all()
        for i, comment in enumerate(comments[:15]):  # Top 15 comments
            try:
                text = comment.inner_text()
                if text and len(text) > 80:
                    content_parts.append(f"\n---\n**Comment {i+1}:**\n{text}")
            except:
                continue
    except:
        pass

    return '\n\n'.join(content_parts)


def fetch_post_content(page, url: str, title: str):
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(2)

        try:
            score_elem = page.locator('.score.unvoted').first
            score = score_elem.text_content().strip() if score_elem.count() > 0 else "0"
        except:
            score = "0"

        content = extract_post_content(page)

        if len(content) < 200:
            return None

        markdown = f"# {title}\n\n**Score:** {score}\n\n{content}\n"
        char_count = len(markdown)

        return {
            'title': title,
            'content': markdown,
            'url': url,
            'char_count': char_count,
            'score': score
        }

    except Exception as e:
        print(f"   Error: {e}")
        return None


def fetch_post_list(page, sort: str = 'top', time_filter: str = 'year'):
    url = f"https://old.reddit.com/r/FulfillmentByAmazon/{sort}/?t={time_filter}"

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(2)

        posts = []
        entries = page.locator('.thing.link').all()

        for entry in entries:
            try:
                title_elem = entry.locator('a.title')
                if title_elem.count() == 0:
                    continue

                title = title_elem.text_content().strip()
                href = title_elem.get_attribute('href')

                if not href:
                    continue

                if href.startswith('/r/'):
                    href = f"https://old.reddit.com{href}"
                elif not href.startswith('http'):
                    continue

                if 'reddit.com/r/' not in href:
                    continue

                try:
                    score_elem = entry.locator('.score.unvoted')
                    score = score_elem.text_content().strip() if score_elem.count() > 0 else "0"
                except:
                    score = "0"

                posts.append({
                    'title': title,
                    'url': href,
                    'score': score
                })

            except:
                continue

        return posts

    except Exception as e:
        print(f"Error: {e}")
        return []


def save_to_markdown(post: dict, output_dir: Path) -> Path:
    filename = re.sub(r'[^\w\s-]', '', post['title'])
    filename = re.sub(r'[-\s]+', '-', filename)
    filename = f"{filename[:60]}.md"

    filepath = output_dir / filename

    content = f"""---
source: Reddit r/FulfillmentByAmazon
source_url: {post['url']}
fetched_at: {time.strftime('%Y-%m-%d')}
char_count: {post['char_count']}
score: {post['score']}
language: en
content_type: community_discussion
tier: T2
---

{post['content']}

---

**Source**: [Reddit r/FulfillmentByAmazon]({post['url']})
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return filepath


def main():
    print(f"[Reddit FBA Expanded] Target: {TARGET_MIN}-{TARGET_MAX} posts\n")

    output_dir = Path.home() / 'data/T2_raw/reddit_fba'
    output_dir.mkdir(parents=True, exist_ok=True)

    stats = {
        'source': 'reddit_fba',
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
            all_posts = []
            seen_urls = set()

            # Multiple sort/time combinations for more posts
            combinations = [
                ('top', 'all'),
                ('top', 'year'),
                ('top', 'month'),
                ('hot', None),
                ('new', None),
            ]

            for sort, time_filter in combinations:
                if time_filter:
                    print(f"[{sort}/{time_filter}] Fetching...")
                else:
                    print(f"[{sort}] Fetching...")

                posts = fetch_post_list(page, sort=sort, time_filter=time_filter if time_filter else 'all')

                for p in posts:
                    if p['url'] not in seen_urls:
                        seen_urls.add(p['url'])
                        all_posts.append(p)

                print(f"   Found {len(posts)}, Total unique: {len(all_posts)}")

                if len(all_posts) >= TARGET_MAX:
                    break

                time.sleep(2)

            stats['total_found'] = len(all_posts)
            all_posts = all_posts[:TARGET_MAX]
            stats['unique_count'] = len(all_posts)

            print(f"\nProcessing {len(all_posts)} posts...\n")

            for i, post in enumerate(all_posts, 1):
                print(f"[{i}/{len(all_posts)}] {post['title'][:40]}...")

                content = fetch_post_content(page, post['url'], post['title'])

                if content:
                    save_to_markdown(content, output_dir)
                    stats['success_count'] += 1
                    stats['total_chars'] += content['char_count']
                    print(f"   OK ({content['char_count']} chars)")
                else:
                    stats['failed_count'] += 1
                    print(f"   SKIP")

                time.sleep(2)

        finally:
            browser.close()

    stats_file = output_dir / '_stats.json'
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)

    print(f"\n=== Reddit FBA Complete ===")
    print(f"Success: {stats['success_count']}")
    print(f"Failed: {stats['failed_count']}")
    print(f"Output: {output_dir}")

    return stats


if __name__ == '__main__':
    main()
