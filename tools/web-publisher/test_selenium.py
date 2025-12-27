#!/usr/bin/env python3
"""测试 Selenium 基本功能"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from pathlib import Path

# 最基本的配置
options = Options()
options.add_argument('--headless=new')
options.add_argument('--no-sandbox')
options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 指定 ChromeDriver 路径
chromedriver_path = str(Path.home() / "bin/chromedriver")
service = Service(executable_path=chromedriver_path)

print(f"使用 ChromeDriver: {chromedriver_path}")
print("尝试启动 Chrome...")
try:
    driver = webdriver.Chrome(service=service, options=options)
    print("✅ Chrome 启动成功！")
    print(f"版本: {driver.capabilities['browserVersion']}")

    # 测试访问网页
    driver.get("https://www.baidu.com")
    print(f"✅ 成功访问百度，标题: {driver.title}")

    driver.quit()
    print("✅ 测试完成")
except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()
