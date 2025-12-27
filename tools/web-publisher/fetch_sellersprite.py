#!/usr/bin/env python3
"""
从卖家精灵博客抓取高质量 Amazon 内容
"""

import requests
from bs4 import BeautifulSoup
import time
from pathlib import Path
import re


def fetch_article_list(start_index=0):
    """获取文章列表"""
    url = f"https://www.sellersprite.com/cn/blog?startIndex={start_index}"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        articles = []
        # 找到所有文章（使用 class="article"）
        for article in soup.find_all(class_='article'):
            # 查找标题和链接
            title_elem = article.find(class_='article-title')
            link_elem = article.find('a') if article.find('a') else None

            if title_elem and link_elem:
                href = link_elem.get('href', '')
                # 确保是完整 URL
                if href.startswith('/'):
                    href = f"https://www.sellersprite.com{href}"
                elif not href.startswith('http'):
                    continue  # 跳过无效链接

                articles.append({
                    'title': title_elem.get_text(strip=True),
                    'url': href
                })

        return articles

    except Exception as e:
        print(f"❌ 获取文章列表失败: {e}")
        return []


def fetch_article_content(url):
    """获取单篇文章内容"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # 找到文章主体（根据卖家精灵网站结构调整）
        article_body = soup.find('article') or soup.find('div', class_='entry-content') or soup.find('main')

        if not article_body:
            print(f"   ⚠️  无法找到文章主体")
            return None

        # 提取标题
        title = soup.find('h1')
        title_text = title.get_text(strip=True) if title else "未知标题"

        # 转换为 Markdown
        markdown = f"# {title_text}\\n\\n"

        # 提取段落和标题
        for elem in article_body.find_all(['p', 'h2', 'h3', 'h4', 'ul', 'ol']):
            if elem.name == 'p':
                text = elem.get_text(strip=True)
                if text and len(text) > 10:
                    markdown += f"{text}\\n\\n"
            elif elem.name == 'h2':
                markdown += f"## {elem.get_text(strip=True)}\\n\\n"
            elif elem.name == 'h3':
                markdown += f"### {elem.get_text(strip=True)}\\n\\n"
            elif elem.name == 'h4':
                markdown += f"#### {elem.get_text(strip=True)}\\n\\n"
            elif elem.name in ['ul', 'ol']:
                for li in elem.find_all('li'):
                    markdown += f"- {li.get_text(strip=True)}\\n"
                markdown += "\\n"

        # 检查内容长度
        char_count = len(markdown)
        if char_count < 1000:
            print(f"   ⚠️  内容太短（{char_count} 字符），跳过")
            return None

        return {
            'title': title_text,
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
    print("🚀 开始抓取卖家精灵博客内容...\\n")

    output_dir = Path.home() / 'github/liye_os/tools/web-publisher/fetched_articles'
    output_dir.mkdir(parents=True, exist_ok=True)

    # 测试：抓取第一页的前 10 篇文章
    print("📋 获取文章列表...")
    articles = fetch_article_list(start_index=0)

    if not articles:
        print("❌ 未找到文章")
        return

    print(f"✅ 找到 {len(articles)} 篇文章\\n")

    # 限制为前 10 篇（测试）
    articles = articles[:10]

    success = 0
    failed = 0

    for i, article in enumerate(articles, 1):
        print(f"[{i}/10] {article['title']}")

        # 抓取文章内容
        content = fetch_article_content(article['url'])

        if content:
            # 保存文件
            filepath = save_to_markdown(content, output_dir)
            print(f"   ✅ 已保存: {filepath.name} ({content['char_count']} 字符)")
            success += 1
        else:
            failed += 1

        # 礼貌延迟
        time.sleep(2)

    print(f"\\n✅ 抓取完成")
    print(f"   成功: {success}")
    print(f"   失败: {failed}")
    print(f"   保存位置: {output_dir}")


if __name__ == '__main__':
    main()
