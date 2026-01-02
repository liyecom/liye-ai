#!/usr/bin/env python3
"""
卖家精灵帮助中心抓取脚本
目标：从帮助中心获取高质量功能文档
来源：https://www.sellersprite.com/cn/help
预计：313篇帮助文章
"""

from playwright.sync_api import sync_playwright
import time
from pathlib import Path
import re
import json

TARGET_MIN = 80
TARGET_MAX = 150  # 帮助文档更多


def extract_help_content(page) -> dict:
    """提取帮助文章内容"""
    try:
        # 获取标题
        title = page.locator('h1').first.text_content().strip()

        # 获取文章主体 - 帮助页面通常有 .help-content 或 .article-content 类
        content_selectors = [
            '.help-content',
            '.article-content',
            '.content-body',
            'article',
            '.main-content'
        ]

        content = ""
        for selector in content_selectors:
            try:
                elem = page.locator(selector).first
                if elem.count() > 0:
                    content = elem.inner_text()
                    if len(content) > 200:
                        break
            except:
                continue

        # 如果找不到特定容器，使用body但过滤导航
        if len(content) < 200:
            full_text = page.locator('body').inner_text()
            content = clean_help_content(full_text, title)

        if len(content) < 200:
            return None

        return {
            'title': title,
            'content': f"# {title}\n\n{content}",
            'char_count': len(content)
        }

    except Exception as e:
        print(f"   Error extracting content: {e}")
        return None


def clean_help_content(text: str, title: str) -> str:
    """清理帮助文档内容"""
    lines = text.split('\n')

    # 跳过的导航/页脚关键词
    skip_keywords = [
        '首页', '后台', 'AI解读', '产品', '价格', '知识库',
        '活动', '品牌', '社区', '直播', '登录', '注册',
        '工作时间', '客服', '邮箱', '版权所有', '蜀ICP备',
        '微信公众号', '扫码', '028-', '139-', '400-',
        '分类标签', '查看全文', '输入关键词',
        '成都云雅信息技术有限公司', '川公网安备'
    ]

    # 找到文章开始位置
    start_idx = -1
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if not line_stripped:
            continue
        # 跳过导航行
        if any(kw in line_stripped for kw in skip_keywords):
            continue
        # 找到标题或第一段内容
        if title in line_stripped or len(line_stripped) > 50:
            start_idx = i
            break

    if start_idx == -1:
        return ""

    # 收集内容直到页脚
    content_lines = []
    for i in range(start_idx, len(lines)):
        line = lines[i].strip()

        # 结束标记
        if any(kw in line for kw in ['工作时间', '版权所有', '蜀ICP备', '分类标签']):
            break

        if not line:
            continue

        # 跳过导航
        if any(kw in line for kw in skip_keywords):
            continue

        content_lines.append(line)

    return '\n\n'.join(content_lines)


def get_all_help_links(page) -> list:
    """获取所有帮助文章链接"""
    all_links = []
    seen_urls = set()

    base_url = "https://www.sellersprite.com/cn/help"

    # 获取所有分类标签
    tags = [
        '',  # 全部
        'Listing质量得分', 'SEM页面', '互动社区', '免费工具',
        '入门引导', '关键词优化', '关键词反查', '关键词挖掘',
        '关键词收录', '关键词选品', '利润计算器', '卖家精灵使用技巧',
        '卖家精灵插件', '卖家精灵插件更新日志', '外观专利',
        '市场分析', '市场调研', '广告洞察', '广告流量词',
        '店铺查询', '扩展流量词', '流量分析', '竞品监控',
        '竞品追踪', '精准选品', '自动下单', '获评邮件',
        '评论分析', '评论下载', '评论监控', '选品精灵', '选品调研'
    ]

    for tag in tags:
        url = f"{base_url}?tag={tag}" if tag else base_url
        print(f"  Scanning tag: {tag or '全部'}...")

        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(1)

            # 获取当前页面的文章链接
            links = page.locator('a[href*="/cn/help/"]').all()

            for link in links:
                try:
                    href = link.get_attribute('href')
                    if not href or href == '/cn/help' or '?' in href or '#' in href:
                        continue

                    if href.startswith('/'):
                        href = f"https://www.sellersprite.com{href}"

                    if href not in seen_urls and '/cn/help/' in href:
                        seen_urls.add(href)
                        title = link.text_content().strip()
                        if title and len(title) > 2:
                            all_links.append({
                                'title': title,
                                'url': href,
                                'tag': tag
                            })
                except:
                    continue

        except Exception as e:
            print(f"    Error scanning tag {tag}: {e}")
            continue

    return all_links


def save_to_markdown(article: dict, output_dir: Path) -> Path:
    """保存为markdown文件"""
    # 生成文件名
    filename = re.sub(r'[^\w\s-]', '', article['title'])
    filename = re.sub(r'[-\s]+', '-', filename)
    filename = f"{filename[:60]}.md"

    filepath = output_dir / filename

    content = f"""---
source: 卖家精灵帮助中心
source_url: {article['url']}
fetched_at: {time.strftime('%Y-%m-%d')}
char_count: {article['char_count']}
language: zh
tier: T2
---

{article['content']}

---

**来源**: [卖家精灵帮助中心]({article['url']})
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return filepath


def main():
    print(f"[Sellersprite Help Center] Target: {TARGET_MIN}-{TARGET_MAX} articles\n")

    output_dir = Path.home() / 'data/T2_raw/sellersprite_help'
    output_dir.mkdir(parents=True, exist_ok=True)

    stats = {
        'source': 'sellersprite_help',
        'total_found': 0,
        'unique_count': 0,
        'success_count': 0,
        'failed_count': 0,
        'total_chars': 0
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # Step 1: 获取所有文章链接
            print("Phase 1: Collecting article links...")
            all_links = get_all_help_links(page)
            stats['total_found'] = len(all_links)

            # 去重并限制数量
            seen_urls = set()
            unique_links = []
            for link in all_links:
                if link['url'] not in seen_urls:
                    seen_urls.add(link['url'])
                    unique_links.append(link)

            unique_links = unique_links[:TARGET_MAX]
            stats['unique_count'] = len(unique_links)

            print(f"\nFound {stats['total_found']} total, {len(unique_links)} unique articles")

            # Step 2: 抓取每篇文章
            print(f"\nPhase 2: Fetching {len(unique_links)} articles...")

            for i, link in enumerate(unique_links, 1):
                print(f"[{i}/{len(unique_links)}] {link['title'][:40]}...")

                try:
                    page.goto(link['url'], wait_until="domcontentloaded", timeout=30000)
                    time.sleep(1)

                    article = extract_help_content(page)

                    if article:
                        article['url'] = link['url']
                        save_to_markdown(article, output_dir)
                        stats['success_count'] += 1
                        stats['total_chars'] += article['char_count']
                        print(f"   OK ({article['char_count']} chars)")
                    else:
                        stats['failed_count'] += 1
                        print(f"   SKIP (insufficient content)")

                except Exception as e:
                    stats['failed_count'] += 1
                    print(f"   ERROR: {e}")

                time.sleep(0.5)

        finally:
            browser.close()

    # 保存统计
    stats_file = output_dir / '_stats.json'
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)

    print(f"\n{'=' * 50}")
    print(f"=== Sellersprite Help Center Complete ===")
    print(f"Success: {stats['success_count']}")
    print(f"Failed: {stats['failed_count']}")
    print(f"Total chars: {stats['total_chars']:,}")
    print(f"Output: {output_dir}")
    print(f"{'=' * 50}")

    return stats


if __name__ == '__main__':
    main()
