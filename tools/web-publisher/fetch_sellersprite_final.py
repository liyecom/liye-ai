#!/usr/bin/env python3
"""
最终版卖家精灵内容抓取脚本
精准提取文章正文，排除所有噪音
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re

def extract_article_body(full_text: str, title: str) -> str:
    """
    精准提取文章正文
    策略：找到标题后的内容，直到遇到评论/页脚等结束标记
    """
    lines = full_text.split('\n')

    # 结束标记
    end_markers = [
        '点赞详情', '全部评论', '最新 (', '最热 (',
        '工作时间：', '邮箱：', '客服：', '市场合作：',
        '版权所有', '蜀ICP备', '川公网安备',
        '成都云雅信息技术有限公司',
        '主人~您还没有收藏的工具'
    ]

    # 导航噪音关键词（需要跳过的行）
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
        '028-', '139-', '400-', '186-', '189-'  # 电话号码
    ]

    # 找到正文开始位置（标题之后的第一段有效内容）
    start_idx = -1
    for i, line in enumerate(lines):
        line = line.strip()

        # 跳过空行
        if not line:
            continue

        # 跳过导航噪音
        if any(kw in line for kw in nav_keywords):
            continue

        # 跳过太短的行
        if len(line) < 15:
            continue

        # 跳过日期行
        if re.match(r'^\d{4}/\d{1,2}/\d{1,2}', line):
            continue

        # 找到第一段有效内容（通常以"对于"、"在"、"随着"等开头）
        if len(line) > 30 and any(line.startswith(prefix) for prefix in ['对于', '在', '随着', '近年来', '本文', '亚马逊', '作为']):
            start_idx = i
            break

    if start_idx == -1:
        return ""

    # 从开始位置提取内容，直到遇到结束标记
    article_lines = []
    for i in range(start_idx, len(lines)):
        line = lines[i].strip()

        # 检查是否到达结束标记
        if any(marker in line for marker in end_markers):
            break

        # 跳过空行
        if not line:
            continue

        # 跳过导航噪音
        if any(kw in line for kw in nav_keywords):
            continue

        # 跳过图片说明
        if line.startswith('（图片来源'):
            continue

        article_lines.append(line)

    return '\n\n'.join(article_lines)


def fetch_article_content(page, url):
    """获取单篇文章内容"""
    try:
        print(f"   正在抓取...")
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(3)

        # 提取标题
        try:
            title = page.locator('h1').first.text_content().strip()
        except:
            title = "未知标题"

        # 获取整个页面文本
        full_text = page.locator('body').inner_text()

        # 精准提取文章正文
        article_body = extract_article_body(full_text, title)

        # 检查内容长度
        if len(article_body) < 300:
            print(f"   ⚠️  提取内容太短（{len(article_body)} 字符），可能不是文章页")
            return None

        # 转换为 Markdown
        markdown = f"# {title}\n\n{article_body}\n"

        char_count = len(markdown)
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
    print("🚀 开始抓取卖家精灵博客（最终版）...\n")

    output_dir = Path.home() / 'github/liye_os/tools/web-publisher/fetched_articles_final'
    output_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        print("🔧 正在初始化浏览器...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 抓取 5 页（约 50 篇文章）
            all_articles = []
            for page_num in range(5):
                start_index = page_num * 11
                articles = fetch_article_list(page, start_index=start_index)

                if not articles:
                    break

                all_articles.extend(articles)
                print(f"已获取 {len(all_articles)} 篇文章...\n")

            if not all_articles:
                print("❌ 未找到文章")
                return

            # 限制为前 50 篇
            all_articles = all_articles[:50]
            total = len(all_articles)

            success = 0
            failed = 0

            for i, article in enumerate(all_articles, 1):
                print(f"[{i}/{total}] {article['title']}")

                content = fetch_article_content(page, article['url'])

                if content:
                    filepath = save_to_markdown(content, output_dir)
                    print(f"   💾 已保存: {filepath.name}\n")
                    success += 1
                else:
                    failed += 1

                # 礼貌延迟
                time.sleep(2)

            print(f"✅ 抓取完成")
            print(f"   成功: {success}")
            print(f"   失败: {failed}")
            print(f"   保存位置: {output_dir}")

        finally:
            browser.close()
            print("\n🔒 浏览器已关闭")


if __name__ == '__main__':
    main()
