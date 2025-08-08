"""
Application service wrapping legacy processor for DDD structure.
"""

from .processor import GHOSTLYC3DProcessor as ProcessorService  # Minimal wrapper

__all__ = ['ProcessorService']

