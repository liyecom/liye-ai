"""
Inventory module for Amazon Growth OS.

Provides inventory-budget linkage to prevent stockouts and optimize spend.
"""

from .inventory_manager import InventoryManager, InventoryStatus, BudgetModifier

__all__ = ['InventoryManager', 'InventoryStatus', 'BudgetModifier']
