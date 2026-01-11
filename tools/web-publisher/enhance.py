#!/usr/bin/env python3
"""
Geo Pipeline - AI 元数据增强层
使用 Claude API 为 units 生成完整的 SEO 元数据 + 联盟营销字段

用法：
    python enhance.py --input /path/to/geo_units.json --output /path/to/enhanced_units.json
    python enhance.py --test  # 测试模式：只处理前 10 个 units
"""

import json
import os
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
import anthropic


# ================================
# 配置
# ================================

CLAUDE_MODEL = "claude-3-5-haiku-20241022"  # Claude 3.5 Haiku（性价比之选）
MAX_TOKENS = 500
TEMPERATURE = 0.7

# 元数据生成 Prompt 模板
PROMPT_TEMPLATE = """请为以下内容生成网站元数据和联盟营销推荐：

内容预览：
{content_preview}

源文件：{source_file}

请生成（严格按 JSON 格式返回）：
1. title: 简洁的标题（50字符以内，吸引点击）
2. description: SEO描述（150字符以内，包含关键词）
3. category: 分类（从以下选择：跨境电商/AI应用/副业创收/营销增长/个人成长/创业投资）
4. keywords: 5个SEO关键词（数组）
5. slug: URL路径（英文，小写，用-分隔，如：how-to-optimize-amazon-listing）
6. affiliate_products: 推荐的联盟产品（从以下选择，可多选）：
   - amazon_seller_tools（Amazon卖家工具）
   - ecommerce_platforms（电商平台）
   - ai_writing_tools（AI写作工具）
   - marketing_software（营销软件）
   - online_courses（在线课程）
   - books（相关书籍）
7. cta_text: Call-to-Action文案（如："查看最佳Amazon工具"）
8. intent: 用户意图（informational=纯学习/commercial=比较选择/transactional=准备购买）

返回严格的JSON格式：
{{
  "title": "...",
  "description": "...",
  "category": "...",
  "keywords": ["...", "...", "...", "...", "..."],
  "slug": "...",
  "affiliate_products": ["...", "..."],
  "cta_text": "...",
  "intent": "informational|commercial|transactional"
}}
"""


# ================================
# 工具函数
# ================================

def load_json(file_path: Path) -> Dict:
    """加载 JSON 文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: Dict, file_path: Path, pretty: bool = True):
    """保存 JSON 文件"""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        if pretty:
            json.dump(data, f, indent=2, ensure_ascii=False)
        else:
            json.dump(data, f, ensure_ascii=False)


def call_claude_api(content: str, source_file: str, api_key: str) -> Dict:
    """
    调用 Claude API 生成元数据

    Args:
        content: unit 内容
        source_file: 源文件路径
        api_key: Anthropic API key

    Returns:
        生成的元数据字典
    """
    client = anthropic.Anthropic(api_key=api_key)

    # 截取内容前 400 字符作为预览
    content_preview = content[:400] if len(content) > 400 else content

    # 构建 prompt
    prompt = PROMPT_TEMPLATE.format(
        content_preview=content_preview,
        source_file=source_file
    )

    try:
        # 调用 API
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        # 提取响应
        response_text = message.content[0].text

        # 尝试解析 JSON
        # 移除可能的 markdown 代码块标记
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        metadata = json.loads(response_text)

        return metadata

    except Exception as e:
        print(f"⚠️  API 调用失败: {e}")
        # 返回默认值
        return {
            "title": "待生成",
            "description": "待生成",
            "category": "其他",
            "keywords": [],
            "slug": "pending",
            "affiliate_products": [],
            "cta_text": "了解更多",
            "intent": "informational"
        }


def enhance_unit(unit: Dict, api_key: str, verbose: bool = False) -> Dict:
    """
    增强单个 unit

    Args:
        unit: 原始 unit 数据
        api_key: Anthropic API key
        verbose: 是否显示详细信息

    Returns:
        增强后的 unit
    """
    if verbose:
        print(f"   处理: {unit['id']}")

    # 调用 API 生成元数据
    metadata = call_claude_api(
        content=unit['content'],
        source_file=unit.get('source_file', 'unknown'),
        api_key=api_key
    )

    # 合并到 unit
    enhanced_unit = unit.copy()
    enhanced_unit.update(metadata)

    return enhanced_unit


def load_cache(cache_file: Path) -> Dict:
    """加载缓存（已处理的 units）"""
    if cache_file.exists():
        return load_json(cache_file)
    return {}


def save_cache(cache: Dict, cache_file: Path):
    """保存缓存"""
    save_json(cache, cache_file)


# ================================
# 主函数
# ================================

def main():
    parser = argparse.ArgumentParser(description='AI 元数据增强层')
    parser.add_argument('--input', type=str, help='输入 JSON 文件路径')
    parser.add_argument('--output', type=str, help='输出 JSON 文件路径')
    parser.add_argument('--test', action='store_true', help='测试模式（只处理前 10 个 units）')
    parser.add_argument('--verbose', '-v', action='store_true', help='显示详细信息')
    parser.add_argument('--resume', action='store_true', help='从缓存恢复（断点续传）')

    args = parser.parse_args()

    # 默认路径
    if not args.input:
        args.input = str(Path.home() / 'data/exports/shengcai/geo_units_v0.1.json')

    if not args.output:
        args.output = str(Path.home() / 'data/exports/shengcai/enhanced_units.json')

    input_path = Path(args.input)
    output_path = Path(args.output)
    cache_file = output_path.parent / f".{output_path.stem}_cache.json"

    # 检查 API key
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print("❌ 错误：未找到 ANTHROPIC_API_KEY 环境变量")
        print("   请设置：export ANTHROPIC_API_KEY='your-api-key'")
        return 1

    # 加载输入
    print(f"📥 加载输入：{input_path}")
    data = load_json(input_path)
    units = data['units']
    total_units = len(units)

    # 测试模式：只处理前 10 个
    if args.test:
        units = units[:10]
        print(f"🧪 测试模式：只处理前 {len(units)} 个 units")

    # 加载缓存
    cache = {}
    if args.resume:
        cache = load_cache(cache_file)
        print(f"♻️  从缓存恢复：已处理 {len(cache)} 个 units")

    # 处理 units
    print(f"\n🚀 开始处理 {len(units)} 个 units...")
    print(f"   模型：{CLAUDE_MODEL}")
    print(f"   预计成本：${len(units) * 0.004:.2f} (Haiku 3.5: 约 600 tokens 输入 + 300 tokens 输出)")
    print()

    enhanced_units = []
    processed_count = 0
    skipped_count = 0
    failed_count = 0

    start_time = datetime.now()

    for i, unit in enumerate(units, 1):
        unit_id = unit['id']

        # 检查缓存
        if unit_id in cache:
            enhanced_units.append(cache[unit_id])
            skipped_count += 1
            if args.verbose:
                print(f"   [{i}/{len(units)}] ⏭️  跳过（已缓存）: {unit_id}")
            continue

        try:
            # 增强 unit
            enhanced_unit = enhance_unit(unit, api_key, verbose=args.verbose)
            enhanced_units.append(enhanced_unit)

            # 更新缓存
            cache[unit_id] = enhanced_unit

            processed_count += 1

            if not args.verbose:
                print(f"   [{i}/{len(units)}] ✅ {unit_id}")

            # 每 10 个保存一次缓存
            if i % 10 == 0:
                save_cache(cache, cache_file)
                if args.verbose:
                    print(f"   💾 缓存已保存（{i} 个）")

        except Exception as e:
            print(f"   [{i}/{len(units)}] ❌ {unit_id}: {e}")
            failed_count += 1

    # 最终保存缓存
    save_cache(cache, cache_file)

    # 生成输出
    output_data = {
        'version': '0.2.0',
        'enhanced_at': datetime.now().isoformat(),
        'unit_count': len(enhanced_units),
        'source_file': str(input_path),
        'units': enhanced_units
    }

    # 保存输出
    print(f"\n💾 保存输出：{output_path}")
    save_json(output_data, output_path)

    # 统计
    elapsed = datetime.now() - start_time
    print(f"\n✅ 处理完成")
    print(f"   总数：{len(units)}")
    print(f"   已处理：{processed_count}")
    print(f"   跳过（缓存）：{skipped_count}")
    print(f"   失败：{failed_count}")
    print(f"   耗时：{elapsed.total_seconds():.1f} 秒")
    print(f"   输出：{output_path}")

    return 0


if __name__ == '__main__':
    exit(main())
