#!/usr/bin/env python3
"""
Reddit r/FulfillmentByAmazon Scraper
抓取 Reddit FBA 社区高分帖子 - 实战经验分享
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re


def extract_post_content(page) -> str:
    """Extract post content including self-text and top comments"""
    content_parts = []

    # Get self-text (post body)
    try:
        selftext = page.locator('.expando .usertext-body').first
        if selftext.count() > 0:
            text = selftext.inner_text()
            if text and len(text) > 50:
                content_parts.append(text)
    except:
        pass

    # Get top comments
    try:
        comments = page.locator('.comment .usertext-body').all()
        for i, comment in enumerate(comments[:10]):  # Top 10 comments
            try:
                text = comment.inner_text()
                if text and len(text) > 100:
                    content_parts.append(f"\n---\n**Comment {i+1}:**\n{text}")
            except:
                continue
    except:
        pass

    return '\n\n'.join(content_parts)


def fetch_post_content(page, url: str, title: str):
    """Fetch single post content"""
    try:
        print(f"   Fetching...")
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(3)

        # Extract score
        try:
            score_elem = page.locator('.score.unvoted').first
            score = score_elem.text_content().strip() if score_elem.count() > 0 else "0"
        except:
            score = "0"

        # Extract content
        content = extract_post_content(page)

        if len(content) < 200:
            print(f"   Warning: Content too short ({len(content)} chars)")
            return None

        markdown = f"# {title}\n\n**Score:** {score}\n\n{content}\n"
        char_count = len(markdown)
        print(f"   Success ({char_count} chars, score: {score})")

        return {
            'title': title,
            'content': markdown,
            'url': url,
            'char_count': char_count,
            'score': score
        }

    except Exception as e:
        print(f"   Failed: {e}")
        return None


def fetch_post_list(page, sort: str = 'top', time_filter: str = 'year'):
    """Fetch post list from subreddit"""
    url = f"https://old.reddit.com/r/FulfillmentByAmazon/{sort}/?t={time_filter}"

    try:
        print(f"Visiting: {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(3)

        posts = []

        # Find all post entries
        entries = page.locator('.thing.link').all()

        for entry in entries:
            try:
                # Get title and link
                title_elem = entry.locator('a.title')
                if title_elem.count() == 0:
                    continue

                title = title_elem.text_content().strip()
                href = title_elem.get_attribute('href')

                # Skip external links (we want self posts)
                if not href:
                    continue

                # Convert to full URL if needed
                if href.startswith('/r/'):
                    href = f"https://old.reddit.com{href}"
                elif not href.startswith('http'):
                    continue

                # Only include reddit self posts
                if 'reddit.com/r/' not in href:
                    continue

                # Get score
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

        print(f"Found {len(posts)} posts")
        return posts

    except Exception as e:
        print(f"Failed: {e}")
        return []


def save_to_markdown(post: dict, output_dir: Path) -> Path:
    """Save post as markdown file"""
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
---

{post['content']}

---

**Source**: [Reddit r/FulfillmentByAmazon]({post['url']})
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return filepath


def main():
    print("Starting Reddit r/FulfillmentByAmazon Scraper...\n")

    output_dir = Path.home() / 'data/archives/reddit_fba'
    output_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        print("Initializing browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        try:
            all_posts = []

            # Get top posts from different time periods
            for time_filter in ['year', 'all']:
                posts = fetch_post_list(page, sort='top', time_filter=time_filter)
                all_posts.extend(posts)
                print(f"Total collected: {len(all_posts)} posts\n")
                time.sleep(2)

            if not all_posts:
                print("No posts found")
                return

            # Remove duplicates
            seen_urls = set()
            unique_posts = []
            for post in all_posts:
                if post['url'] not in seen_urls:
                    seen_urls.add(post['url'])
                    unique_posts.append(post)

            # Limit to 30 posts
            unique_posts = unique_posts[:30]
            total = len(unique_posts)

            print(f"\nProcessing {total} unique posts...\n")

            success = 0
            failed = 0

            for i, post in enumerate(unique_posts, 1):
                print(f"[{i}/{total}] {post['title'][:50]}...")

                content = fetch_post_content(page, post['url'], post['title'])

                if content:
                    filepath = save_to_markdown(content, output_dir)
                    print(f"   Saved: {filepath.name}\n")
                    success += 1
                else:
                    failed += 1

                time.sleep(3)

            print(f"\nScraping complete!")
            print(f"   Success: {success}")
            print(f"   Failed: {failed}")
            print(f"   Output: {output_dir}")

        finally:
            browser.close()
            print("\nBrowser closed")


if __name__ == '__main__':
    main()
