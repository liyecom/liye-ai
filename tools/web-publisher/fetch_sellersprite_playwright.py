#!/usr/bin/env python3
"""
使用 Playwright 从卖家精灵博客抓取高质量 Amazon 内容
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re


def fetch_article_list(page, start_index=0):
    """获取文章列表"""
    url = f"https://www.sellersprite.com/cn/blog?startIndex={start_index}"

    try:
        print(f"📋 正在访问: {url}")
        # 使用 domcontentloaded 替代 networkidle，增加超时时间
        page.goto(url, wait_until="domcontentloaded", timeout=60000)

        # 等待文章列表加载
        page.wait_for_selector('.article', timeout=15000)

        # 额外等待
        time.sleep(2)

        # 提取所有文章
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

        print(f"✅ 找到 {len(article_list)} 篇文章")
        return article_list

    except Exception as e:
        print(f"❌ 获取文章列表失败: {e}")
        return []


def fetch_article_content(page, url):
    """获取单篇文章内容"""
    try:
        print(f"   正在抓取...")
        # 使用 domcontentloaded 替代 networkidle，增加超时时间
        page.goto(url, wait_until="domcontentloaded", timeout=60000)

        # 等待内容加载
        time.sleep(3)

        # 尝试多种选择器
        article_body = None
        selectors = ['.article-content', '.content', 'article', '.post-content', '.entry-content']

        for selector in selectors:
            try:
                if page.locator(selector).count() > 0:
                    article_body = page.locator(selector).first
                    break
            except:
                continue

        if not article_body:
            print(f"   ⚠️  无法找到文章主体")
            return None

        # 提取标题
        try:
            title = page.locator('h1').first.text_content().strip()
        except:
            title = "未知标题"

        # 提取内容
        markdown = f"# {title}\n\n"

        # 直接提取文章的 inner HTML 并转换
        # 先尝试获取所有内容
        full_text = article_body.inner_text()

        # 如果inner_text太短，说明选择器错误
        if len(full_text) < 500:
            # 尝试整个页面的 main 标签
            if page.locator('main').count() > 0:
                full_text = page.locator('main').first.inner_text()

        # 分段处理
        paragraphs = [p.strip() for p in full_text.split('\n\n') if p.strip() and len(p.strip()) > 20]

        for para in paragraphs[:100]:  # 限制最多100段
            markdown += f"{para}\n\n"

        # 检查内容长度
        char_count = len(markdown)
        if char_count < 1000:
            print(f"   ⚠️  内容太短（{char_count} 字符），跳过")
            return None

        print(f"   ✅ 抓取成功（{char_count} 字符）")

        return {
            'title': title,
            'content': markdown,
            'url': url,
            'char_count': char_count
        }

    except Exception as e:
        print(f"   ❌ 抓取失败: {e}")
        return None


def save_to_markdown(article, output_dir):
    """保存为 Markdown 文件"""
    # 生成文件名
    filename = re.sub(r'[^\w\s-]', '', article['title'])
    filename = re.sub(r'[-\s]+', '-', filename)
    filename = f"{filename[:50]}.md"

    filepath = output_dir / filename

    # 添加元信息
    content = f"""---
source: 卖家精灵
source_url: {article['url']}
fetched_at: {time.strftime('%Y-%m-%d')}
char_count: {article['char_count']}
---

{article['content']}

---

**来源**: [卖家精灵]({article['url']})
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return filepath


def main():
    print("🚀 开始使用 Playwright 抓取卖家精灵博客内容...\n")

    output_dir = Path.home() / 'github/liye_os/tools/web-publisher/fetched_articles'
    output_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        # 启动浏览器
        print("🔧 正在初始化浏览器...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 抓取前 5 页（每页约 10-11 篇）
            all_articles = []
            for page_num in range(5):
                start_index = page_num * 11  # 每页约11篇
                articles = fetch_article_list(page, start_index=start_index)

                if not articles:
                    break

                all_articles.extend(articles)
                print(f"已获取 {len(all_articles)} 篇文章...")

            if not all_articles:
                print("❌ 未找到文章")
                return

            # 限制为前 50 篇
            all_articles = all_articles[:50]
            total = len(all_articles)

            success = 0
            failed = 0

            for i, article in enumerate(all_articles, 1):
                print(f"\n[{i}/{total}] {article['title']}")

                # 抓取文章内容
                content = fetch_article_content(page, article['url'])

                if content:
                    # 保存文件
                    filepath = save_to_markdown(content, output_dir)
                    print(f"   💾 已保存: {filepath.name}")
                    success += 1
                else:
                    failed += 1

                # 礼貌延迟
                time.sleep(2)

            print(f"\n✅ 抓取完成")
            print(f"   成功: {success}")
            print(f"   失败: {failed}")
            print(f"   保存位置: {output_dir}")

        finally:
            browser.close()
            print("\n🔒 浏览器已关闭")


if __name__ == '__main__':
    main()
