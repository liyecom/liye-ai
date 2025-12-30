#!/usr/bin/env python3
"""
Jungle Scout Blog Scraper
抓取 Jungle Scout 博客文章 - Amazon 运营权威内容
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re


def extract_article_body(page) -> str:
    """
    Extract main article content from Jungle Scout blog page
    """
    try:
        # Try common article content selectors
        selectors = [
            'article',
            '.article-content',
            '.post-content',
            '.entry-content',
            'main article',
            '[class*="article"]',
            '[class*="content"]'
        ]

        for selector in selectors:
            try:
                element = page.locator(selector).first
                if element.count() > 0:
                    text = element.inner_text()
                    if len(text) > 500:
                        return text
            except:
                continue

        # Fallback: get body text and filter
        body_text = page.locator('body').inner_text()
        return body_text

    except Exception as e:
        print(f"   Error extracting body: {e}")
        return ""


def clean_content(text: str, title: str) -> str:
    """
    Clean extracted content, removing navigation and footer noise
    """
    lines = text.split('\n')

    # End markers - stop extraction when these are found
    end_markers = [
        'Subscribe to our newsletter',
        'Related articles',
        'Share this post',
        'Leave a comment',
        'About the author',
        'Start your Amazon business',
        'Get started with Jungle Scout',
        'Sign up for free',
        'Footer',
        '© 2025 Jungle Scout',
        'Privacy Policy',
        'Terms of Service'
    ]

    # Navigation noise to skip
    nav_keywords = [
        'Sign in', 'Sign up', 'Get started', 'Free trial',
        'Pricing', 'Features', 'Resources', 'Blog',
        'Product Research', 'Keyword Scout', 'Sales Estimator',
        'Contact us', 'Support', 'Help center',
        'Facebook', 'Twitter', 'LinkedIn', 'Instagram',
        'Cookie', 'Accept all'
    ]

    # Find content start (usually after navigation)
    start_idx = 0
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if not line_stripped:
            continue
        # Look for article start indicators
        if len(line_stripped) > 50 and not any(kw in line_stripped for kw in nav_keywords):
            start_idx = i
            break

    # Extract content until end marker
    content_lines = []
    for i in range(start_idx, len(lines)):
        line = lines[i].strip()

        # Check for end markers
        if any(marker.lower() in line.lower() for marker in end_markers):
            break

        # Skip empty lines
        if not line:
            continue

        # Skip navigation noise
        if any(kw in line for kw in nav_keywords):
            continue

        # Skip very short lines (likely buttons/labels)
        if len(line) < 10:
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

        # Extract raw content
        raw_content = extract_article_body(page)

        # Clean content
        article_body = clean_content(raw_content, title)

        # Validate content length
        if len(article_body) < 500:
            print(f"   Warning: Content too short ({len(article_body)} chars)")
            return None

        # Convert to markdown
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
    url = f"https://www.junglescout.com/blog/"
    if page_num > 1:
        url = f"https://www.junglescout.com/blog/page/{page_num}/"

    try:
        print(f"Visiting: {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(3)

        # Find all article links
        articles = []

        # Try multiple selectors for article links
        link_selectors = [
            'a[href*="/resources/articles/"]',
            'a[href*="/blog/"]',
            '.article-card a',
            'article a',
            'h2 a', 'h3 a'
        ]

        for selector in link_selectors:
            try:
                links = page.locator(selector).all()
                for link in links:
                    href = link.get_attribute('href')
                    if href and '/resources/articles/' in href:
                        # Get full URL
                        if href.startswith('/'):
                            href = f"https://www.junglescout.com{href}"

                        # Get title
                        try:
                            title = link.text_content().strip()
                        except:
                            title = href.split('/')[-2].replace('-', ' ').title()

                        if href not in [a['url'] for a in articles]:
                            articles.append({
                                'title': title,
                                'url': href
                            })
            except:
                continue

        print(f"Found {len(articles)} articles")
        return articles

    except Exception as e:
        print(f"Failed to get article list: {e}")
        return []


def save_to_markdown(article: dict, output_dir: Path) -> Path:
    """Save article as markdown file"""
    # Generate filename
    filename = re.sub(r'[^\w\s-]', '', article['title'])
    filename = re.sub(r'[-\s]+', '-', filename)
    filename = f"{filename[:60]}.md"

    filepath = output_dir / filename

    # Add frontmatter
    content = f"""---
source: Jungle Scout
source_url: {article['url']}
fetched_at: {time.strftime('%Y-%m-%d')}
char_count: {article['char_count']}
language: en
---

{article['content']}

---

**Source**: [Jungle Scout]({article['url']})
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return filepath


def main():
    print("Starting Jungle Scout Blog Scraper...\n")

    output_dir = Path.home() / 'data/archives/junglescout'
    output_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        print("Initializing browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Set user agent to avoid bot detection
        page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        try:
            # Collect articles from multiple pages
            all_articles = []

            for page_num in range(1, 4):  # First 3 pages
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

            # Limit to first 30 articles
            unique_articles = unique_articles[:30]
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

                # Polite delay
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
