#!/usr/bin/env python3
"""
使用 Selenium 从卖家精灵博客抓取高质量 Amazon 内容
适用于 JavaScript 渲染的动态网站
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
import time
from pathlib import Path
import re


def setup_driver():
    """配置 Chrome WebDriver"""
    chrome_options = Options()
    chrome_options.add_argument('--headless=new')  # 新版无头模式
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36')

    # 设置 Chrome 二进制路径
    chrome_options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

    # Selenium 4 会自动使用 Selenium Manager 下载匹配的 ChromeDriver
    service = Service()
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver


def fetch_article_list(driver, start_index=0):
    """获取文章列表"""
    url = f"https://www.sellersprite.com/cn/blog?startIndex={start_index}"

    try:
        print(f"📋 正在访问: {url}")
        driver.get(url)

        # 等待文章列表加载（等待 class="article" 的元素出现）
        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "article")))

        # 额外等待 JavaScript 完全执行
        time.sleep(2)

        # 查找所有文章
        article_elements = driver.find_elements(By.CLASS_NAME, "article")

        articles = []
        for article in article_elements:
            try:
                # 查找标题和链接
                title_elem = article.find_element(By.CLASS_NAME, "article-title")
                link_elem = article.find_element(By.TAG_NAME, "a")

                href = link_elem.get_attribute("href")
                if href and href.startswith("/"):
                    href = f"https://www.sellersprite.com{href}"

                articles.append({
                    'title': title_elem.text.strip(),
                    'url': href
                })
            except Exception as e:
                continue

        print(f"✅ 找到 {len(articles)} 篇文章")
        return articles

    except Exception as e:
        print(f"❌ 获取文章列表失败: {e}")
        return []


def fetch_article_content(driver, url):
    """获取单篇文章内容"""
    try:
        print(f"   正在抓取: {url}")
        driver.get(url)

        # 等待文章主体加载
        wait = WebDriverWait(driver, 10)

        # 尝试多种可能的文章容器 class
        article_body = None
        selectors = [
            (By.CLASS_NAME, "article-content"),
            (By.CLASS_NAME, "content"),
            (By.TAG_NAME, "article"),
            (By.CLASS_NAME, "post-content"),
            (By.CLASS_NAME, "entry-content")
        ]

        for by, value in selectors:
            try:
                wait.until(EC.presence_of_element_located((by, value)))
                article_body = driver.find_element(by, value)
                break
            except:
                continue

        if not article_body:
            print(f"   ⚠️  无法找到文章主体")
            return None

        # 额外等待内容加载
        time.sleep(2)

        # 提取标题
        try:
            title = driver.find_element(By.TAG_NAME, "h1").text.strip()
        except:
            title = "未知标题"

        # 转换为 Markdown
        markdown = f"# {title}\n\n"

        # 提取段落、标题和列表
        elements = article_body.find_elements(By.XPATH, ".//*[self::p or self::h2 or self::h3 or self::h4 or self::ul or self::ol]")

        for elem in elements:
            tag_name = elem.tag_name
            text = elem.text.strip()

            if not text:
                continue

            if tag_name == 'p' and len(text) > 10:
                markdown += f"{text}\n\n"
            elif tag_name == 'h2':
                markdown += f"## {text}\n\n"
            elif tag_name == 'h3':
                markdown += f"### {text}\n\n"
            elif tag_name == 'h4':
                markdown += f"#### {text}\n\n"
            elif tag_name in ['ul', 'ol']:
                list_items = elem.find_elements(By.TAG_NAME, "li")
                for li in list_items:
                    li_text = li.text.strip()
                    if li_text:
                        markdown += f"- {li_text}\n"
                markdown += "\n"

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
    print("🚀 开始使用 Selenium 抓取卖家精灵博客内容...\n")

    output_dir = Path.home() / 'github/liye_os/tools/web-publisher/fetched_articles'
    output_dir.mkdir(parents=True, exist_ok=True)

    # 设置 WebDriver
    print("🔧 正在初始化 Chrome WebDriver...")
    driver = setup_driver()

    try:
        # 测试：抓取第一页的前 10 篇文章
        articles = fetch_article_list(driver, start_index=0)

        if not articles:
            print("❌ 未找到文章")
            return

        # 限制为前 10 篇（测试）
        articles = articles[:10]

        success = 0
        failed = 0

        for i, article in enumerate(articles, 1):
            print(f"\n[{i}/10] {article['title']}")

            # 抓取文章内容
            content = fetch_article_content(driver, article['url'])

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
        # 关闭浏览器
        driver.quit()
        print("\n🔒 浏览器已关闭")


if __name__ == '__main__':
    main()
