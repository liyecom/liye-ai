#!/usr/bin/env python3
"""
改进的卖家精灵内容抓取脚本
使用更智能的内容识别逻辑，排除导航菜单
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re

def clean_navigation_noise(text: str) -> str:
    """清理导航菜单噪音"""
    # 常见的导航关键词
    nav_keywords = [
        '中文', '日本語', '首页', '后台', 'AI解读', '产品', '价格',
        '优麦云', '知识库', '快速入门', '视频课堂', '功能手册',
        '运营干货', '客服咨询', '达人招募', '加入我们',
        '精灵知识库', '从这里开启', '活动 HOT', '媒体报道',
        '荣誉奖项', '展会风采', '品牌', '社区', '直播',
        '大数据选品', '关键词优化', '运营推广', '浏览器插件',
        '免费工具', '前往功能手册', '行业资讯', '查看更多',
        '座机', '微信公众号', '扫码'
    ]

    lines = text.split('\n')
    cleaned_lines = []

    for line in lines:
        line = line.strip()
        # 跳过空行
        if not line:
            continue
        # 跳过导航关键词行
        if any(kw in line for kw in nav_keywords):
            continue
        # 跳过太短的行（可能是导航）
        if len(line) < 10:
            continue

        cleaned_lines.append(line)

    return '\n\n'.join(cleaned_lines)


def fetch_article_content(page, url):
    """获取单篇文章内容"""
    try:
        print(f"   正在抓取...")
        page.goto(url, wait_until="domcontentloaded", timeout=60000)

        # 等待内容加载
        time.sleep(3)

        # 尝试找到主要内容区域
        article_body = None

        # 策略1: 查找 main 标签内的内容
        if page.locator('main').count() > 0:
            article_body = page.locator('main').first

        # 策略2: 查找包含大段文字的 div
        if not article_body or len(article_body.inner_text()) < 500:
            # 查找所有 div，选择文本最长的
            divs = page.locator('div').all()
            longest_div = None
            max_length = 0

            for div in divs:
                try:
                    text = div.inner_text()
                    if len(text) > max_length:
                        max_length = len(text)
                        longest_div = div
                except:
                    continue

            if longest_div and max_length > 1000:
                article_body = longest_div

        if not article_body:
            print(f"   ⚠️  无法找到文章主体")
            return None

        # 提取标题
        try:
            title = page.locator('h1').first.text_content().strip()
        except:
            title = "未知标题"

        # 提取内容并清理
        full_text = article_body.inner_text()
        cleaned_text = clean_navigation_noise(full_text)

        # 检查清理后的内容长度
        if len(cleaned_text) < 500:
            print(f"   ⚠️  清理后内容太短（{len(cleaned_text)} 字符），可能是导航页")
            return None

        # 转换为 Markdown
        markdown = f"# {title}\n\n{cleaned_text}\n"

        char_count = len(markdown)
        print(f"   ✅ 抓取成功（{char_count} 字符，清理后）")

        return {
            'title': title,
            'content': markdown,
            'url': url,
            'char_count': char_count
        }

    except Exception as e:
        print(f"   ❌ 抓取失败: {e}")
        return None


def fetch_article_list(page, start_index=0):
    """获取文章列表"""
    url = f"https://www.sellersprite.com/cn/blog?startIndex={start_index}"

    try:
        print(f"📋 正在访问: {url}")
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

        print(f"✅ 找到 {len(article_list)} 篇文章")
        return article_list

    except Exception as e:
        print(f"❌ 获取文章列表失败: {e}")
        return []


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
    print("🚀 开始抓取卖家精灵博客（改进版）...\\n")

    output_dir = Path.home() / 'github/liye_os/tools/web-publisher/fetched_articles_v2'
    output_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        print("🔧 正在初始化浏览器...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 先测试单页（10 篇文章）
            articles = fetch_article_list(page, start_index=0)

            if not articles:
                print("❌ 未找到文章")
                return

            # 限制为前 10 篇（测试）
            articles = articles[:10]
            total = len(articles)

            success = 0
            failed = 0

            for i, article in enumerate(articles, 1):
                print(f"\\n[{i}/{total}] {article['title']}")

                content = fetch_article_content(page, article['url'])

                if content:
                    filepath = save_to_markdown(content, output_dir)
                    print(f"   💾 已保存: {filepath.name}")
                    success += 1
                else:
                    failed += 1

                # 礼貌延迟
                time.sleep(2)

            print(f"\\n✅ 抓取完成")
            print(f"   成功: {success}")
            print(f"   失败: {failed}")
            print(f"   保存位置: {output_dir}")

        finally:
            browser.close()
            print("\\n🔒 浏览器已关闭")


if __name__ == '__main__':
    main()
