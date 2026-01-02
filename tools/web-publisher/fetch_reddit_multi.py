#!/usr/bin/env python3
"""
Reddit 多 Subreddit 扩量抓取脚本
目标：从多个电商相关 subreddit 获取高质量讨论
输出：~/data/T2_raw/reddit_{subreddit}/
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re
import json

# 目标 subreddits 和每个的目标数量
SUBREDDITS = [
    ('AmazonSeller', 50),          # Amazon卖家社区
    ('ecommerce', 40),              # 电商综合讨论
    ('Entrepreneur', 30),           # 创业者社区
    ('AmazonMerch', 30),            # Merch by Amazon
]


def extract_post_content(page) -> str:
    """提取帖子内容和评论"""
    content_parts = []

    # 帖子正文
    try:
        selftext = page.locator('.expando .usertext-body').first
        if selftext.count() > 0:
            text = selftext.inner_text()
            if text and len(text) > 50:
                content_parts.append(text)
    except:
        pass

    # Top评论
    try:
        comments = page.locator('.comment .usertext-body').all()
        for i, comment in enumerate(comments[:15]):
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
    """抓取单个帖子内容"""
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


def fetch_post_list(page, subreddit: str, sort: str = 'top', time_filter: str = 'year'):
    """获取帖子列表"""
    url = f"https://old.reddit.com/r/{subreddit}/{sort}/?t={time_filter}"

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

                # 只要Reddit帖子，不要外链
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
        print(f"Error fetching list: {e}")
        return []


def save_to_markdown(post: dict, subreddit: str, output_dir: Path) -> Path:
    """保存为markdown"""
    filename = re.sub(r'[^\w\s-]', '', post['title'])
    filename = re.sub(r'[-\s]+', '-', filename)
    filename = f"{filename[:60]}.md"

    filepath = output_dir / filename

    content = f"""---
source: Reddit r/{subreddit}
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

**Source**: [Reddit r/{subreddit}]({post['url']})
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return filepath


def process_subreddit(page, subreddit: str, target_count: int, base_output_dir: Path) -> dict:
    """处理单个subreddit"""
    print(f"\n{'=' * 50}")
    print(f"[r/{subreddit}] Target: {target_count} posts")
    print(f"{'=' * 50}")

    output_dir = base_output_dir / f"reddit_{subreddit.lower()}"
    output_dir.mkdir(parents=True, exist_ok=True)

    stats = {
        'subreddit': subreddit,
        'total_found': 0,
        'unique_count': 0,
        'success_count': 0,
        'failed_count': 0,
        'total_chars': 0
    }

    all_posts = []
    seen_urls = set()

    # 多种排序组合
    combinations = [
        ('top', 'all'),
        ('top', 'year'),
        ('top', 'month'),
        ('hot', 'all'),
    ]

    for sort, time_filter in combinations:
        print(f"  [{sort}/{time_filter}] Fetching...")

        posts = fetch_post_list(page, subreddit, sort=sort, time_filter=time_filter)

        for p in posts:
            if p['url'] not in seen_urls:
                seen_urls.add(p['url'])
                all_posts.append(p)

        print(f"    Found {len(posts)}, Total unique: {len(all_posts)}")

        if len(all_posts) >= target_count:
            break

        time.sleep(2)

    stats['total_found'] = len(all_posts)
    all_posts = all_posts[:target_count]
    stats['unique_count'] = len(all_posts)

    print(f"\n  Processing {len(all_posts)} posts...")

    for i, post in enumerate(all_posts, 1):
        print(f"  [{i}/{len(all_posts)}] {post['title'][:35]}...")

        content = fetch_post_content(page, post['url'], post['title'])

        if content:
            save_to_markdown(content, subreddit, output_dir)
            stats['success_count'] += 1
            stats['total_chars'] += content['char_count']
            print(f"     OK ({content['char_count']} chars)")
        else:
            stats['failed_count'] += 1
            print(f"     SKIP")

        time.sleep(1.5)

    # 保存统计
    stats_file = output_dir / '_stats.json'
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)

    return stats


def main():
    print("=" * 60)
    print("[Reddit Multi-Subreddit Expansion]")
    print("=" * 60)

    total_target = sum(count for _, count in SUBREDDITS)
    print(f"Total target: {total_target} posts across {len(SUBREDDITS)} subreddits\n")

    base_output_dir = Path.home() / 'data/T2_raw'
    all_stats = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        try:
            for subreddit, target_count in SUBREDDITS:
                stats = process_subreddit(page, subreddit, target_count, base_output_dir)
                all_stats.append(stats)
                time.sleep(3)

        finally:
            browser.close()

    # 汇总统计
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    total_success = 0
    total_failed = 0
    total_chars = 0

    for stats in all_stats:
        print(f"r/{stats['subreddit']}: {stats['success_count']} success, {stats['failed_count']} failed")
        total_success += stats['success_count']
        total_failed += stats['failed_count']
        total_chars += stats['total_chars']

    print(f"\nTotal: {total_success} success, {total_failed} failed")
    print(f"Total chars: {total_chars:,}")

    # 保存汇总统计
    summary_file = base_output_dir / 'reddit_multi_stats.json'
    with open(summary_file, 'w') as f:
        json.dump({
            'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'subreddits': all_stats,
            'totals': {
                'success': total_success,
                'failed': total_failed,
                'chars': total_chars
            }
        }, f, indent=2)

    print(f"\nStats saved to: {summary_file}")

    return all_stats


if __name__ == '__main__':
    main()
