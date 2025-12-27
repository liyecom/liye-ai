#!/usr/bin/env python3
"""
深度内容清洗：移除空表格、优化 Markdown 结构
"""

import re
from pathlib import Path


def remove_empty_tables(content: str) -> str:
    """移除空表格（只有表头没有数据的表格）"""
    lines = content.split('\n')
    cleaned = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # 检测表格开始（包含 | 的行）
        if '|' in line and not line.strip().startswith('#'):
            # 检查是否是表头
            table_start = i
            
            # 跳过表头行
            i += 1
            
            # 检查分隔符行
            if i < len(lines) and re.match(r'^\s*\|\s*[-:]+\s*(\|\s*[-:]+\s*)*\|\s*$', lines[i]):
                i += 1
                
                # 检查是否有数据行
                has_data = False
                while i < len(lines) and '|' in lines[i]:
                    # 如果数据行不全是空格，则保留
                    if lines[i].strip() != '|' and not re.match(r'^\s*\|\s*\|\s*$', lines[i]):
                        has_data = True
                        break
                    i += 1
                
                # 如果没有数据，跳过整个表格
                if not has_data:
                    continue
                else:
                    # 有数据，保留表格
                    for j in range(table_start, i):
                        cleaned.append(lines[j])
            else:
                # 不是完整表格，保留原行
                cleaned.append(lines[table_start])
        else:
            cleaned.append(line)
            i += 1
    
    return '\n'.join(cleaned)


def improve_structure(content: str) -> str:
    """改善内容结构"""
    # 移除空表格
    content = remove_empty_tables(content)
    
    # 移除多余空行（超过2个连续空行压缩为1个）
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    # 移除开头和结尾的空行
    content = content.strip()
    
    return content


def process_file(file_path: Path) -> bool:
    """处理单个文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 分离 frontmatter
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            body = parts[2]
        else:
            frontmatter = ''
            body = content
        
        # 清洗 body
        original_length = len(body)
        cleaned_body = improve_structure(body)
        new_length = len(cleaned_body)
        
        # 重组
        if frontmatter:
            cleaned_content = f"---{frontmatter}---\n{cleaned_body}\n"
        else:
            cleaned_content = cleaned_body
        
        # 如果有变化，保存
        if cleaned_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(cleaned_content)
            print(f"   ✅ {file_path.name} (减少 {original_length - new_length} 字符)")
            return True
        
        return False
        
    except Exception as e:
        print(f"   ❌ {file_path.name}: {e}")
        return False


def main():
    posts_dir = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'
    
    print(f"🧹 深度清洗内容...\n   目录: {posts_dir}\n")
    
    md_files = sorted(posts_dir.glob('*.md'))
    modified = 0
    
    for file_path in md_files:
        if process_file(file_path):
            modified += 1
    
    print(f"\n✅ 深度清洗完成")
    print(f"   总文件: {len(md_files)}")
    print(f"   已修改: {modified}")
    print(f"   未改动: {len(md_files) - modified}")


if __name__ == '__main__':
    main()
