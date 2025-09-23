"""Patient Repository.
==================

🎯 PURPOSE: Patient data management with RGPD-compliant PII separation
- Patient profiles in public schema (pseudonymized)
- Personal data in private schema (encrypted/protected)
- Schema v2.1 compliant UUID relationships

📊 SUPABASE PATTERNS:
- Schema separation (public.patients + private.patient_pii)
- Row Level Security (RLS) compliance
- UUID foreign key relationships
- Optimized queries with proper indexing

"""

import logging
from typing import Any
from uuid import UUID

from services.shared.repositories.base.abstract_repository import (
    AbstractRepository,
    RepositoryError,
)
from models.clinical.patient import Patient, PatientCreate, PatientUpdate

logger = logging.getLogger(__name__)


class PatientRepository(AbstractRepository[PatientCreate, PatientUpdate, Patient]):
    """Repository for patient data management with PII separation.

    Handles both pseudonymized patient profiles (public schema) and
    personally identifiable information (private schema) following
    RGPD compliance requirements.
    """

    def get_table_name(self) -> str:
        """Return primary table name for patients."""
        return "patients"

    def get_create_model(self) -> type[PatientCreate]:
        """Return the Pydantic model class for create operations."""
        return PatientCreate

    def get_update_model(self) -> type[PatientUpdate]:
        """Return the Pydantic model class for update operations."""
        return PatientUpdate

    def get_response_model(self) -> type[Patient]:
        """Return the Pydantic model class for response operations."""
        return Patient

    def create_patient(
        self, patient_data: dict[str, Any], pii_data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Create new patient with optional PII data.

        Args:
            patient_data: Patient profile data (pseudonymized)
            pii_data: Personal identifiable information (optional)

        Returns:
            Dict: Created patient profile

        Raises:
            RepositoryError: If creation fails
        """
        try:
            # Prepare patient profile data
            profile_data = self._prepare_timestamps(patient_data.copy())

            # Validate required fields
            if "therapist_id" not in profile_data:
                raise RepositoryError("Patient must have therapist_id")

            # Validate therapist_id as UUID
            profile_data["therapist_id"] = self._validate_uuid(
                profile_data["therapist_id"], "therapist_id"
            )

            # Create patient profile in public schema
            result = self.client.table("patients").insert(profile_data).execute()

            created_patient = self._handle_supabase_response(result, "create", "patient")[0]

            # Create PII data if provided
            if pii_data:
                pii_data["patient_id"] = created_patient["id"]
                pii_data = self._prepare_timestamps(pii_data)

                pii_result = self.client.table("patient_pii").insert(pii_data).execute()

                self._handle_supabase_response(pii_result, "create", "patient PII")

            self.logger.info(f"✅ Created patient: {created_patient['id']}")
            return created_patient

        except Exception as e:
            error_msg = f"Failed to create patient: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def get_patient_profile(self, patient_id: str | UUID) -> dict[str, Any] | None:
        """Get patient profile (pseudonymized data only).

        Args:
            patient_id: Patient UUID

        Returns:
            Optional[Dict]: Patient profile or None if not found
        """
        try:
            validated_id = self._validate_uuid(patient_id, "patient_id")

            result = (
                self.client.table("patients").select("*").eq("id", validated_id).limit(1).execute()
            )

            data = self._handle_supabase_response(result, "get", "patient profile")
            return data[0] if data else None

        except Exception as e:
            self.logger.exception(f"Failed to get patient profile {patient_id}: {e!s}")
            raise RepositoryError(f"Failed to get patient profile: {e!s}") from e

    def get_patient_pii(self, patient_id: str | UUID) -> dict[str, Any] | None:
        """Get patient personally identifiable information (private schema).

        Args:
            patient_id: Patient UUID

        Returns:
            Optional[Dict]: Patient PII or None if not found
        """
        try:
            validated_id = self._validate_uuid(patient_id, "patient_id")

            result = (
                self.client.table("patient_pii")
                .select("*")
                .eq("patient_id", validated_id)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "patient PII")
            return data[0] if data else None

        except Exception as e:
            self.logger.exception(f"Failed to get patient PII {patient_id}: {e!s}")
            raise RepositoryError(f"Failed to get patient PII: {e!s}") from e

    def get_patients_by_therapist(
        self, therapist_id: str | UUID, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Get all patients for a specific therapist.

        Args:
            therapist_id: Therapist UUID
            limit: Optional limit on results

        Returns:
            List[Dict]: List of patient profiles
        """
        try:
            validated_id = self._validate_uuid(therapist_id, "therapist_id")

            query = (
                self.client.table("patients")
                .select("*")
                .eq("therapist_id", validated_id)
                .order("created_at", desc=True)
            )

            if limit:
                query = query.limit(limit)

            result = query.execute()

            return self._handle_supabase_response(result, "get", "patients by therapist")

        except Exception as e:
            self.logger.exception(f"Failed to get patients for therapist {therapist_id}: {e!s}")
            raise RepositoryError(f"Failed to get patients for therapist: {e!s}") from e

    def update_patient_profile(
        self, patient_id: str | UUID, update_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Update patient profile data.

        Args:
            patient_id: Patient UUID
            update_data: Data to update

        Returns:
            Dict: Updated patient profile
        """
        try:
            validated_id = self._validate_uuid(patient_id, "patient_id")
            update_data = self._prepare_timestamps(update_data, update=True)

            result = (
                self.client.table("patients").update(update_data).eq("id", validated_id).execute()
            )

            updated_data = self._handle_supabase_response(result, "update", "patient profile")

            if not updated_data:
                raise RepositoryError(f"Patient {patient_id} not found for update")

            self.logger.info(f"✅ Updated patient profile: {patient_id}")
            return updated_data[0]

        except Exception as e:
            error_msg = f"Failed to update patient profile {patient_id}: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def get_patient_by_code(self, patient_code: str) -> dict[str, Any] | None:
        """Get patient by patient_code (e.g., P039).

        Args:
            patient_code: Patient code (e.g., 'P039')

        Returns:
            Optional[Dict]: Patient data or None if not found
        """
        try:
            if not patient_code or not isinstance(patient_code, str):
                raise RepositoryError("Invalid patient_code provided")

            result = (
                self.client.table("patients")
                .select("*")
                .eq("patient_code", patient_code.upper())
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "patient by code")
            return data[0] if data else None

        except Exception as e:
            self.logger.exception(f"Failed to get patient by code {patient_code}: {e!s}")
            raise RepositoryError(f"Failed to get patient by code: {e!s}") from e
