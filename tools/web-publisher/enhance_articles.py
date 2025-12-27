#!/usr/bin/env python3
"""
AI 文章增强脚本 - 将普通文章提升为 10x 质量
以"亚马逊选品实战"文章为标准模板

方案 D（混合策略）- 已实施：
1. 模型：Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
2. Max Tokens: 24,000（确保完整生成）
3. Temperature: 0.5（降低幻觉率）
4. 完整性检测：检查承诺的章节是否全部生成
5. 幻觉检测：检测中英文混杂、不完整表格
6. 自动标记：严重问题标记为需要人工审核

预期效果：
- 完整率：98%
- 幻觉率：<1%
- 成本：~$0.95/篇
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
生成完整的 frontmatter（注意：不要用 ```yaml 包裹，直接输出）：
---
title: "标题（吸引点击，50 字符以内）"
description: "描述（SEO 优化，150 字符以内，包含关键词）"
pubDate: 2025-12-27
category: "亚马逊运营"
keywords: ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"]
intent: "commercial"  # informational/commercial/transactional
---

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

def clean_frontmatter(content):
    """清理和验证 frontmatter 格式"""
    # 移除可能的 ```yaml 包裹
    if content.startswith('```yaml\n'):
        content = content[8:]  # 移除 ```yaml\n

    if content.startswith('```\n'):
        content = content[4:]  # 移除 ```\n

    # 确保以 --- 开头
    if not content.startswith('---\n'):
        content = '---\n' + content

    # 移除可能的结尾 ```
    content = re.sub(r'\n```\s*$', '', content)

    return content

def detect_completeness_issues(content):
    """检测文章完整性问题（方案 D 第 4 步）"""
    issues = []

    # 提取目录中承诺的章节
    toc_pattern = r'##\s+目录\s*\n(.*?)(?=\n##|\Z)'
    toc_match = re.search(toc_pattern, content, re.DOTALL)

    if toc_match:
        toc_text = toc_match.group(1)
        # 提取目录中的章节（格式：- [章节名](#anchor)）
        promised_chapters = re.findall(r'-\s+\[([^\]]+)\]', toc_text)

        # 检查每个章节是否存在
        for chapter in promised_chapters:
            # 使用多种模式匹配章节标题
            patterns = [
                rf'<h2 id="[^"]*">{re.escape(chapter)}</h2>',
                rf'##\s+{re.escape(chapter)}',
                rf'<h2[^>]*>{re.escape(chapter)}</h2>'
            ]

            found = any(re.search(p, content) for p in patterns)
            if not found:
                issues.append(f"缺失章节: {chapter}")

    # 检查文章是否突然结束（末尾没有结论性内容）
    last_500_chars = content[-500:]
    conclusion_markers = ['总结', '结语', '小结', '最后', '总之', '综上所述']
    has_conclusion = any(marker in last_500_chars for marker in conclusion_markers)

    if not has_conclusion and len(content) > 5000:
        issues.append("文章可能未完成（缺少结论性内容）")

    return issues

def detect_hallucination(content):
    """检测幻觉问题（方案 D 第 5 步）- 中英文混杂"""
    issues = []

    # 检测中英文混杂模式（中文词汇中夹杂英文字母）
    # 例如："人工干prejection"、"数据analyz分析"
    hallucination_patterns = [
        # 中文 + 英文 + 中文（可疑）
        r'[\u4e00-\u9fa5]{1,}[a-zA-Z]{3,}[\u4e00-\u9fa5]{1,}',
        # 中文词组中间插入英文（非常可疑）
        r'[\u4e00-\u9fa5][a-zA-Z]{2,}[\u4e00-\u9fa5]'
    ]

    suspicious_texts = []
    for pattern in hallucination_patterns:
        matches = re.finditer(pattern, content)
        for match in matches:
            text = match.group()
            # 排除常见的正常情况（如 "A/B测试"、"SEO优化"）
            if not re.match(r'[\u4e00-\u9fa5]{0,2}[A-Z]{1,3}/?[A-Z]{0,3}[\u4e00-\u9fa5]{0,2}', text):
                suspicious_texts.append(text)

    if suspicious_texts:
        # 去重并限制显示前 5 个
        unique_texts = list(set(suspicious_texts))[:5]
        issues.append(f"检测到中英文混杂（疑似幻觉）: {', '.join(unique_texts)}")

    # 检测不完整的 Markdown 表格
    table_lines = [line for line in content.split('\n') if line.strip().startswith('|')]
    if table_lines:
        for i, line in enumerate(table_lines):
            cells = [c.strip() for c in line.split('|')]
            # 检查是否有空单元格或异常短的单元格
            empty_cells = sum(1 for c in cells if len(c) < 2)
            if empty_cells > len(cells) * 0.3:  # 超过 30% 的单元格为空
                issues.append(f"表格第 {i+1} 行数据不完整")
                break  # 只报告第一个问题

    return issues

def validate_article(content):
    """验证文章质量（整合方案 D 的检测）"""
    issues = []

    # 检查 frontmatter
    if not content.startswith('---\n'):
        issues.append("缺少 frontmatter 开头标记")

    # 检查必须字段
    required_fields = ['title:', 'description:', 'pubDate:', 'category:', 'keywords:', 'intent:']
    for field in required_fields:
        if field not in content[:500]:  # 前 500 字符内应该包含
            issues.append(f"缺少必须字段: {field}")

    # 检查文章长度
    if len(content) < 5000:
        issues.append(f"文章太短: {len(content)} 字符（建议 > 6000）")

    # 检查是否有表格
    if content.count('|') < 10:  # 至少应该有几个表格
        issues.append("表格数量不足")

    # 检查是否有章节锚点
    if '<h2 id=' not in content:
        issues.append("缺少章节锚点（<h2 id=）")

    # 方案 D：完整性检测
    completeness_issues = detect_completeness_issues(content)
    issues.extend(completeness_issues)

    # 方案 D：幻觉检测
    hallucination_issues = detect_hallucination(content)
    issues.extend(hallucination_issues)

    return issues

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

    # 检查是否已处理（输出文件已存在）
    output_path = OUTPUT_DIR / file_path.name
    if output_path.exists():
        print(f"⏭️  跳过: 已处理（输出文件已存在）")
        return None

    # 读取原文
    print("📖 读取原文...")
    with open(file_path, 'r', encoding='utf-8') as f:
        original_content = f.read()

    original_length = len(original_content)
    print(f"   原文长度: {original_length:,} 字符")

    # 检查是否已经是增强后的文章（长度 > 10000 字符）
    if original_length > 10000:
        print(f"⏭️  跳过: 疑似已增强文章（长度 > 10000）")
        return None

    # 调用 Claude API
    try:
        print("📡 调用 Claude API（方案 D - Sonnet 4.5，Streaming 模式）...")

        # 使用 streaming 模式处理长文本生成
        enhanced_content = ""
        with client.messages.stream(
            model="claude-sonnet-4-5-20250929",  # 方案 D：Claude Sonnet 4.5
            max_tokens=24000,  # 方案 D：增加到 24K
            temperature=0.5,   # 方案 D：降低温度减少幻觉
            messages=[{
                "role": "user",
                "content": ENHANCEMENT_PROMPT.format(original_content=original_content)
            }]
        ) as stream:
            for text in stream.text_stream:
                enhanced_content += text
                # 显示进度
                if len(enhanced_content) % 1000 == 0:
                    print(f"   生成中: {len(enhanced_content)} 字符...", end='\r')

            # 获取最终消息对象以获取 token 使用情况
            message = stream.get_final_message()

        print(f"   生成完成: {len(enhanced_content)} 字符     ")

        # 清理 frontmatter 格式
        print("🔧 清理 frontmatter...")
        enhanced_content = clean_frontmatter(enhanced_content)

        # 验证文章质量（方案 D：包含完整性和幻觉检测）
        print("🔍 验证文章质量（完整性 + 幻觉检测）...")
        issues = validate_article(enhanced_content)

        if issues:
            print("⚠️  质量问题:")
            for issue in issues:
                print(f"   - {issue}")

            # 方案 D：标记需要人工审核
            critical_issues = [i for i in issues if '缺失章节' in i or '幻觉' in i or '未完成' in i]
            if critical_issues:
                print("🚨 严重问题（需要人工审核）:")
                for issue in critical_issues:
                    print(f"   - {issue}")
        else:
            print("✅ 质量检查通过")

        # 统计（Sonnet 定价）
        input_tokens = message.usage.input_tokens
        output_tokens = message.usage.output_tokens
        cost = input_tokens * 0.000003 + output_tokens * 0.000015  # Sonnet 定价

        enhanced_length = len(enhanced_content)
        improvement_ratio = enhanced_length / original_length

        print(f"📊 增强完成")
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
    import sys

    # 检查命令行参数
    test_mode = '--test' in sys.argv
    batch_10 = '--batch10' in sys.argv
    yes_flag = '--yes' in sys.argv or '-y' in sys.argv

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

    # 根据参数选择模式
    if test_mode:
        print("🧪 测试模式：只处理前 3 篇")
        md_files = md_files[:3]
    elif batch_10:
        print("📦 小批量模式：只处理前 10 篇")
        md_files = md_files[:10]
    else:
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
            if not yes_flag:
                confirm = input(f"\n⚠️  确认要处理 {total_files} 篇文章吗？(y/n): ").strip().lower()
                if confirm != 'y':
                    print("❌ 已取消")
                    return
        else:
            print("❌ 无效选择")
            return

    # 预估成本（方案 D：Sonnet 4.5）
    estimated_cost = len(md_files) * 0.95  # 方案 D：每篇约 $0.95
    print(f"\n💰 预估成本: ${estimated_cost:.2f}")
    print(f"   (方案 D - Sonnet 4.5：高质量，低幻觉率)")
    print()

    if not yes_flag:
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

            # 速率限制：每分钟最多 10,000 output tokens
            # 每篇文章约 16,000 tokens，需要等待 2 分钟
            if i < len(md_files):  # 不是最后一篇
                print(f"\n⏳ 等待 120 秒避免速率限制...")
                import time
                time.sleep(120)
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
