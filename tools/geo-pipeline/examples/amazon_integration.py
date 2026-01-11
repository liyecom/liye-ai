"""
示例：Amazon Growth Engine如何消费GEO输出

这个文件演示了Application System如何使用Geo Pipeline的输出。
"""

import json
from pathlib import Path


class GEOKnowledgeReader:
    """
    GEO知识读取器
    供Application Systems使用
    """
    
    def __init__(self, export_path=None):
        """
        初始化
        
        Args:
            export_path: geo_units.json路径，默认使用latest
        """
        if export_path is None:
            export_path = Path.home() / "data/exports/shengcai/geo_units_latest.json"
        
        self.export_path = Path(export_path)
        self.units = self._load()
    
    def _load(self):
        """加载geo_units.json"""
        if not self.export_path.exists():
            print(f"⚠️  Warning: {self.export_path} not found")
            return []
        
        data = json.loads(self.export_path.read_text(encoding='utf-8'))
        return data.get('units', [])
    
    def search(self, keyword: str) -> list:
        """
        搜索包含关键词的知识单元
        
        Args:
            keyword: 搜索关键词
            
        Returns:
            匹配的units列表
        """
        results = []
        keyword_lower = keyword.lower()
        
        for unit in self.units:
            if keyword_lower in unit['content'].lower():
                results.append(unit)
        
        return results
    
    def get_by_topic(self, topic: str) -> list:
        """
        按主题获取知识
        
        Args:
            topic: 主题名称
            
        Returns:
            相关units列表
        """
        results = []
        
        for unit in self.units:
            headings = unit.get('metadata', {}).get('headings', [])
            for heading in headings:
                if topic.lower() in heading['text'].lower():
                    results.append(unit)
                    break
        
        return results
    
    def get_unit_by_id(self, unit_id: str):
        """
        通过ID获取unit
        
        Args:
            unit_id: unit ID
            
        Returns:
            unit或None
        """
        for unit in self.units:
            if unit['id'] == unit_id:
                return unit
        return None
    
    def stats(self):
        """获取统计信息"""
        if not self.units:
            return {"total_units": 0}
        
        return {
            "total_units": len(self.units),
            "total_chars": sum(u.get('metadata', {}).get('char_count', 0) 
                              for u in self.units),
            "units_with_headings": sum(1 for u in self.units 
                                      if u.get('metadata', {}).get('headings')),
            "units_with_bullets": sum(1 for u in self.units 
                                     if u.get('metadata', {}).get('bullets'))
        }


# ============================================================================
# 使用示例
# ============================================================================

def example_usage():
    """使用示例"""
    print("=" * 60)
    print("GEO Knowledge Reader - Usage Example")
    print("=" * 60)
    
    # 1. 初始化reader
    reader = GEOKnowledgeReader()
    
    # 2. 获取统计信息
    stats = reader.stats()
    print(f"\n📊 Statistics:")
    print(f"   Total units: {stats['total_units']}")
    print(f"   Total chars: {stats.get('total_chars', 0):,}")
    
    # 3. 搜索示例
    print(f"\n🔍 Search Example:")
    keyword = "亚马逊"
    results = reader.search(keyword)
    print(f"   Search for '{keyword}': {len(results)} results")
    
    if results:
        print(f"\n   First result preview:")
        first = results[0]
        print(f"   ID: {first['id']}")
        print(f"   Content: {first['content'][:100]}...")
    
    # 4. 按主题查询示例
    print(f"\n📚 Topic Query Example:")
    topic = "选品"
    results = reader.get_by_topic(topic)
    print(f"   Topic '{topic}': {len(results)} results")


if __name__ == "__main__":
    # TODO: 这个示例需要先运行Geo Pipeline生成数据
    print("TODO: Run Geo Pipeline first to generate data")
    print("\nExample usage:")
    print("  python run.py                  # 运行Geo Pipeline")
    print("  python examples/amazon_integration.py  # 运行此示例")
    
    # example_usage()
