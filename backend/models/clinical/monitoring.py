"""
BFR Monitoring Models
====================

Models for Blood Flow Restriction (BFR) monitoring and safety compliance.
Tracks pressure measurements and safety parameters during therapy sessions.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from ..shared.base import DatabaseBaseModel
from ..shared.enums import MeasurementMethod


# =============================================================================
# BFR MONITORING MODELS
# =============================================================================

class BFRMonitoringBase(DatabaseBaseModel):
    """Base fields for BFR monitoring"""
    session_id: UUID
    
    # Pressure monitoring
    target_pressure_aop: float = Field(50.0)
    actual_pressure_aop: float
    cuff_pressure_mmhg: Optional[float] = Field(None, ge=0)
    
    # Blood pressure (safety monitoring)
    systolic_bp_mmhg: Optional[float] = Field(None, ge=80, le=250)
    diastolic_bp_mmhg: Optional[float] = Field(None, ge=40, le=150)
    
    # Safety compliance
    safety_compliant: bool = True
    
    # Measurement metadata
    measurement_timestamp: Optional[datetime] = None
    measurement_method: MeasurementMethod = MeasurementMethod.AUTOMATIC


class BFRMonitoringCreate(BFRMonitoringBase):
    """Model for creating BFR monitoring records"""
    pass


class BFRMonitoringUpdate(BaseModel):
    """Model for updating BFR monitoring"""
    actual_pressure_aop: Optional[float] = None
    cuff_pressure_mmhg: Optional[float] = Field(None, ge=0)
    systolic_bp_mmhg: Optional[float] = Field(None, ge=80, le=250)
    diastolic_bp_mmhg: Optional[float] = Field(None, ge=40, le=150)
    safety_compliant: Optional[bool] = None
    measurement_method: Optional[MeasurementMethod] = None


class BFRMonitoring(BFRMonitoringBase):
    """Complete BFR monitoring model"""
    id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


__all__ = [
    'BFRMonitoringBase', 'BFRMonitoringCreate', 'BFRMonitoringUpdate', 'BFRMonitoring'
]