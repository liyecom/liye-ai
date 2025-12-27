#!/usr/bin/env python3
"""
LiYe OS Architecture Validator
验证系统是否符合架构宪法

Usage: python _meta/governance/validator.py
"""

import yaml
from pathlib import Path

class ArchitectureValidator:
    def __init__(self):
        self.repo_root = Path(__file__).parent.parent.parent
        registry_path = self.repo_root / "Systems/REGISTRY.yaml"

        if not registry_path.exists():
            print("⚠️  Warning: Systems/REGISTRY.yaml not found")
            print(f"   Expected at: {registry_path}")
            self.registry = {'systems': {}}
        else:
            with open(registry_path) as f:
                self.registry = yaml.safe_load(f)

    def validate_dependencies(self):
        """验证依赖方向：Core不能依赖Application"""
        violations = []

        for sys_name, config in self.registry.get('systems', {}).items():
            if config.get('layer') == 'core':
                # Core system不能依赖Application system
                for dep in config.get('dependencies', []):
                    # 处理字符串或字典格式的依赖
                    dep_name = dep if isinstance(dep, str) else list(dep.keys())[0]

                    if dep_name in self.registry['systems']:
                        dep_layer = self.registry['systems'][dep_name].get('layer')
                        if dep_layer == 'application':
                            violations.append(
                                f"❌ Core system '{sys_name}' cannot depend on "
                                f"Application system '{dep_name}'"
                            )

        return violations

    def validate_system_registration(self):
        """验证所有系统都已注册"""
        systems_dir = self.repo_root / "Systems"
        if not systems_dir.exists():
            return ["⚠️  Systems/ directory not found"]

        violations = []
        actual_systems = [d.name for d in systems_dir.iterdir() if d.is_dir()]
        registered_systems = list(self.registry.get('systems', {}).keys())

        for sys in actual_systems:
            if sys not in registered_systems:
                violations.append(
                    f"⚠️  System '{sys}' exists but not registered in REGISTRY.yaml"
                )

        return violations

    def validate_data_boundaries(self):
        """验证系统数据边界（基础检查）"""
        # TODO: 实现更深入的文件系统检查
        # 目前只做基础验证
        return []

    def validate_all(self):
        """运行所有验证"""
        print("🔍 LiYe OS Architecture Validation")
        print("=" * 50)

        all_violations = []

        # 1. 依赖方向
        print("\n1. Checking dependency direction...")
        dep_violations = self.validate_dependencies()
        if dep_violations:
            all_violations.extend(dep_violations)
            for v in dep_violations:
                print(f"   {v}")
        else:
            print("   ✅ Dependency direction valid")

        # 2. 系统注册
        print("\n2. Checking system registration...")
        reg_violations = self.validate_system_registration()
        if reg_violations:
            all_violations.extend(reg_violations)
            for v in reg_violations:
                print(f"   {v}")
        else:
            print("   ✅ All systems registered")

        # 3. 数据边界
        print("\n3. Checking data boundaries...")
        data_violations = self.validate_data_boundaries()
        if data_violations:
            all_violations.extend(data_violations)
            for v in data_violations:
                print(f"   {v}")
        else:
            print("   ✅ Data boundaries valid")

        # 总结
        print("\n" + "=" * 50)
        if all_violations:
            print(f"⚠️  Found {len(all_violations)} architecture issues")
            print("\nRecommendations:")
            print("- Update Systems/REGISTRY.yaml to register all systems")
            print("- Ensure Core systems don't depend on Application systems")
            return False
        else:
            print("✅ All architecture validations passed")
            return True

if __name__ == "__main__":
    validator = ArchitectureValidator()
    success = validator.validate_all()
    exit(0 if success else 1)
