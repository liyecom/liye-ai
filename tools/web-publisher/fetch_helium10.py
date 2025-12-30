#!/usr/bin/env python3
"""
Helium 10 Blog Scraper
抓取 Helium 10 博客文章 - Amazon PPC/SEO 权威内容
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re


def clean_content(text: str) -> str:
    """
    Clean extracted content, removing navigation and footer noise
    """
    lines = text.split('\n')

    # End markers
    end_markers = [
        'Subscribe', 'Newsletter', 'Related Posts', 'Share this',
        'Leave a comment', 'About the author', 'Get Started',
        'Sign up', 'Free Trial', 'Footer', '© 2025',
        'Privacy Policy', 'Terms of Service', 'All Rights Reserved',
        'Helium 10 Tools', 'Start Your Free Trial'
    ]

    # Navigation noise
    nav_keywords = [
        'Sign in', 'Sign up', 'Get started', 'Free trial',
        'Pricing', 'Tools', 'Resources', 'Solutions',
        'Contact', 'Support', 'Help', 'Academy',
        'Facebook', 'Twitter', 'LinkedIn', 'YouTube',
        'Cookie', 'Accept', 'Decline'
    ]

    # Find content start
    start_idx = 0
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if not line_stripped:
            continue
        # Look for substantial content
        if len(line_stripped) > 80 and not any(kw in line_stripped for kw in nav_keywords):
            start_idx = i
            break

    # Extract until end marker
    content_lines = []
    for i in range(start_idx, len(lines)):
        line = lines[i].strip()

        # Check end markers
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
    """Fetch single article content"""
    try:
        print(f"   Fetching...")
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(3)

        # Extract title
        try:
            title = page.locator('h1').first.text_content().strip()
        except:
            title = "Unknown Title"

        # Try to get article content
        content = ""
        selectors = [
            'article', '.post-content', '.entry-content',
            '.blog-content', 'main article', '[class*="content"]'
        ]

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

        # Clean content
        article_body = clean_content(content)

        if len(article_body) < 500:
            print(f"   Warning: Content too short ({len(article_body)} chars)")
            return None

        markdown = f"# {title}\n\n{article_body}\n"
        char_count = len(markdown)
        print(f"   Success ({char_count} chars)")

        return {
            'title': title,
            'content': markdown,
            'url': url,
            'char_count': char_count
        }

    except Exception as e:
        print(f"   Failed: {e}")
        return None


def fetch_article_list(page, page_num: int = 1):
    """Fetch article list from blog page"""
    if page_num == 1:
        url = "https://www.helium10.com/blog/"
    else:
        url = f"https://www.helium10.com/blog/page/{page_num}/"

    try:
        print(f"Visiting: {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(3)

        articles = []

        # Find all blog post links
        links = page.locator('a[href*="/blog/"]').all()

        for link in links:
            try:
                href = link.get_attribute('href')
                if not href:
                    continue

                # Filter for actual blog posts (not category/tag pages)
                if '/blog/page/' in href or '/blog/category/' in href or '/blog/tag/' in href:
                    continue

                # Must be a blog post URL
                if not re.match(r'https://www\.helium10\.com/blog/[\w-]+/?$', href):
                    continue

                # Get title
                try:
                    title = link.text_content().strip()
                    if len(title) < 10:
                        continue
                except:
                    continue

                if href not in [a['url'] for a in articles]:
                    articles.append({
                        'title': title[:100],
                        'url': href
                    })
            except:
                continue

        print(f"Found {len(articles)} articles")
        return articles

    except Exception as e:
        print(f"Failed: {e}")
        return []


def save_to_markdown(article: dict, output_dir: Path) -> Path:
    """Save article as markdown file"""
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
---

{article['content']}

---

**Source**: [Helium 10]({article['url']})
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return filepath


def main():
    print("Starting Helium 10 Blog Scraper...\n")

    output_dir = Path.home() / 'data/archives/helium10'
    output_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        print("Initializing browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        try:
            all_articles = []

            # Scrape first 5 pages
            for page_num in range(1, 6):
                articles = fetch_article_list(page, page_num)
                if not articles:
                    break
                all_articles.extend(articles)
                print(f"Total collected: {len(all_articles)} articles\n")
                time.sleep(2)

            if not all_articles:
                print("No articles found")
                return

            # Remove duplicates
            seen_urls = set()
            unique_articles = []
            for article in all_articles:
                if article['url'] not in seen_urls:
                    seen_urls.add(article['url'])
                    unique_articles.append(article)

            # Limit to 50 articles
            unique_articles = unique_articles[:50]
            total = len(unique_articles)

            print(f"\nProcessing {total} unique articles...\n")

            success = 0
            failed = 0

            for i, article in enumerate(unique_articles, 1):
                print(f"[{i}/{total}] {article['title'][:50]}...")

                content = fetch_article_content(page, article['url'])

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
