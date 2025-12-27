#!/usr/bin/env python3
"""
AI 文章增强脚本 - 将普通文章提升为 10x 质量
以"亚马逊选品实战"文章为标准模板
"""

import os
import sys
import json
import re
from pathlib import Path
from datetime import datetime

# 检查依赖
try:
    from anthropic import Anthropic
except ImportError:
    print("❌ 错误：未安装 anthropic 包")
    print("请运行: pip install anthropic")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    # 加载 .env 文件
    env_path = Path.home() / "github/liye_os/.env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass  # python-dotenv 未安装，跳过

# ================================
# 配置
# ================================

API_KEY = os.getenv('ANTHROPIC_API_KEY')
if not API_KEY:
    print("❌ 错误：未找到 ANTHROPIC_API_KEY 环境变量")
    print("请运行: export ANTHROPIC_API_KEY='your-api-key'")
    sys.exit(1)

client = Anthropic(api_key=API_KEY)

# 路径配置
POSTS_DIR = Path("/Users/liye/github/liye_os/websites/amazon-optimization/src/content/posts")
OUTPUT_DIR = POSTS_DIR / "_enhanced"
OUTPUT_DIR.mkdir(exist_ok=True)

# ================================
# 标准文章模板（Prompt）
# ================================

ENHANCEMENT_PROMPT = """你是一位专业的亚马逊运营内容编辑，擅长将技术性文章转化为吸引人的实战教程。

# 任务
将下面的原始文章改写为 10x 质量的深度教程，参考以下标准：

# 质量标准（参考文章："亚马逊选品实战：竞品店铺法30天找到月利润5000美元产品"）

## 1. 结构要求
- **开头**：核心数据表格（投资回报率、时间、利润等）
- **目录**：6-8 个章节，可直接跳转（使用 `<h2 id="章节名">` 格式）
- **章节分布**：
  - 第一部分：痛点/问题（为什么需要这个方法）
  - 第二部分：完整流程（5-7 个步骤）
  - 第三部分：真实案例（数据 + 截图描述）
  - 第四部分：数据复盘（时间线 + 表格）
  - 第五部分：避坑指南（3-5 个常见错误）
  - 第六部分：工具清单（必备 + 免费替代）

## 2. 内容要求
- **真实数据**：具体数字（不要"大约"、"很多"，要"187 单"、"$4,847"）
- **可操作性**：手把手教学（"点击哪里"、"输入什么"、"如何筛选"）
- **表格可视化**：数据用表格呈现（Markdown 表格）
- **对比分析**：失败案例 vs 成功案例
- **时间线**：Week 1-8 详细记录
- **工具推荐**：具体工具名 + 价格 + 功能

## 3. 写作风格
- **第一人称**："我的失败史"、"我如何操作"
- **对话感**：提问 + 回答（"为什么？因为..."）
- **痛点先行**：先讲失败，再讲成功
- **数据支撑**：每个结论都有数据
- **可复制性**：读者看完能立即执行

## 4. Frontmatter 要求
生成完整的 frontmatter：
```yaml
---
title: "标题（吸引点击，50 字符以内）"
description: "描述（SEO 优化，150 字符以内，包含关键词）"
pubDate: 2025-12-27
category: "亚马逊运营"
keywords: ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"]
intent: "commercial"  # informational/commercial/transactional
---
```

## 5. 必须包含的元素
- [ ] 开篇数据表格（核心指标）
- [ ] 目录（6-8 个章节，带锚点）
- [ ] 至少 3 个数据表格
- [ ] 至少 1 个失败案例
- [ ] 至少 1 个成功案例
- [ ] 具体工具推荐（名称 + 价格）
- [ ] 可复制的流程（步骤 1-N）
- [ ] 避坑指南（常见错误）

---

# 原始文章

{original_content}

---

# 输出要求

1. **输出完整的 Markdown 文件**（包含 frontmatter）
2. **字数要求**：6,000-10,000 字
3. **章节锚点**：使用 `<h2 id="章节名">` 格式（方便目录跳转）
4. **表格**：至少 5 个数据表格
5. **可操作性**：读者看完能立即执行

# 特别提醒

- 不要使用"根据文章内容"、"原文提到"等元语言
- 不要写"本文将介绍"，直接开始
- 不要用"我们"，用"我"
- 数据要具体（不要"很多"，要"187 单"）
- 避免空洞的建议（如"认真分析"），要具体操作（如"打开 Jungle Scout，点击 Product Database，设置筛选条件：月销量 300-1000"）

现在开始改写：
"""

# ================================
# 工具函数
# ================================

def should_skip(file_path):
    """判断是否跳过文件"""
    name = file_path.name

    # 跳过 README 文件
    if 'README' in name or name.startswith('_'):
        return True, "README 文件"

    # 跳过标准文章（模板）
    if '亚马逊选品实战竞品店铺法' in name:
        return True, "标准模板文章"

    return False, None

def enhance_article(file_path):
    """增强单篇文章"""
    print(f"\n{'='*60}")
    print(f"📄 处理: {file_path.name}")
    print(f"{'='*60}")

    # 检查是否跳过
    skip, reason = should_skip(file_path)
    if skip:
        print(f"⏭️  跳过: {reason}")
        return None

    # 读取原文
    print("📖 读取原文...")
    with open(file_path, 'r', encoding='utf-8') as f:
        original_content = f.read()

    original_length = len(original_content)
    print(f"   原文长度: {original_length:,} 字符")

    # 调用 Claude API
    try:
        print("📡 调用 Claude API...")

        message = client.messages.create(
            model="claude-3-5-sonnet-20240620",  # Claude 3.5 Sonnet (稳定版本)
            max_tokens=16000,  # 允许长篇输出
            temperature=0.7,
            messages=[{
                "role": "user",
                "content": ENHANCEMENT_PROMPT.format(original_content=original_content)
            }]
        )

        enhanced_content = message.content[0].text

        # 统计
        input_tokens = message.usage.input_tokens
        output_tokens = message.usage.output_tokens
        cost = input_tokens * 0.000003 + output_tokens * 0.000015

        enhanced_length = len(enhanced_content)
        improvement_ratio = enhanced_length / original_length

        print(f"✅ 增强完成")
        print(f"   增强后长度: {enhanced_length:,} 字符")
        print(f"   改进倍数: {improvement_ratio:.1f}x")
        print(f"   输入 tokens: {input_tokens:,}")
        print(f"   输出 tokens: {output_tokens:,}")
        print(f"   成本: ${cost:.4f}")

        # 保存增强后的文章
        output_path = OUTPUT_DIR / file_path.name
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(enhanced_content)

        print(f"💾 已保存: {output_path}")

        return {
            'file': file_path.name,
            'original_length': original_length,
            'enhanced_length': enhanced_length,
            'improvement_ratio': improvement_ratio,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'cost': cost,
            'output_path': str(output_path)
        }

    except Exception as e:
        print(f"❌ 错误: {str(e)}")
        return None

def main():
    """主函数"""
    print("=" * 60)
    print("🚀 AI 文章增强脚本 - 10x 质量提升")
    print("=" * 60)
    print(f"📁 输入目录: {POSTS_DIR}")
    print(f"📁 输出目录: {OUTPUT_DIR}")
    print()

    # 获取所有文章
    md_files = sorted(POSTS_DIR.glob("*.md"))
    total_files = len(md_files)

    print(f"📊 找到 {total_files} 篇文章")
    print()

    # 询问用户
    print("🤔 选择模式:")
    print("  1. 测试模式（只处理前 3 篇）")
    print("  2. 小批量（只处理前 10 篇）")
    print("  3. 批量模式（处理所有文章）")
    choice = input("请输入 (1/2/3): ").strip()

    if choice == '1':
        print("\n🧪 测试模式：只处理前 3 篇")
        md_files = md_files[:3]
    elif choice == '2':
        print("\n📦 小批量模式：只处理前 10 篇")
        md_files = md_files[:10]
    elif choice == '3':
        confirm = input(f"\n⚠️  确认要处理 {total_files} 篇文章吗？(y/n): ").strip().lower()
        if confirm != 'y':
            print("❌ 已取消")
            return
    else:
        print("❌ 无效选择")
        return

    # 预估成本
    estimated_cost = len(md_files) * 0.15  # 假设每篇 $0.15
    print(f"\n💰 预估成本: ${estimated_cost:.2f}")
    print(f"   (实际成本取决于文章长度和输出质量)")
    print()

    confirm = input("确认继续？(y/n): ").strip().lower()
    if confirm != 'y':
        print("❌ 已取消")
        return

    # 处理文章
    results = []
    total_cost = 0
    skipped = 0

    start_time = datetime.now()

    for i, file_path in enumerate(md_files, 1):
        print(f"\n[{i}/{len(md_files)}]")
        result = enhance_article(file_path)

        if result:
            results.append(result)
            total_cost += result['cost']
        else:
            skipped += 1

    # 计算总时间
    elapsed = datetime.now() - start_time

    # 输出统计
    print("\n" + "=" * 60)
    print("📊 处理完成统计")
    print("=" * 60)
    print(f"✅ 成功: {len(results)} 篇")
    print(f"⏭️  跳过: {skipped} 篇")
    print(f"💰 总成本: ${total_cost:.2f}")
    print(f"⏱️  总耗时: {int(elapsed.total_seconds())} 秒 ({elapsed.total_seconds()/60:.1f} 分钟)")
    print(f"📁 输出目录: {OUTPUT_DIR}")
    print()

    if results:
        avg_cost = total_cost / len(results)
        avg_improvement = sum(r['improvement_ratio'] for r in results) / len(results)

        print(f"📈 平均数据:")
        print(f"   平均成本: ${avg_cost:.4f}/篇")
        print(f"   平均改进: {avg_improvement:.1f}x")
        print()

    # 保存统计
    stats_file = OUTPUT_DIR / "_stats.json"
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_files': len(md_files),
            'processed': len(results),
            'skipped': skipped,
            'total_cost': total_cost,
            'elapsed_seconds': elapsed.total_seconds(),
            'results': results
        }, f, indent=2, ensure_ascii=False)

    print(f"📊 统计文件已保存: {stats_file}")
    print()
    print("✨ 完成！检查 _enhanced/ 目录查看增强后的文章")

if __name__ == "__main__":
    main()
