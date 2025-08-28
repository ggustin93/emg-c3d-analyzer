"""Webhook Security Service
=======================

Simple, secure webhook signature verification.
Follows security best practices for webhook authentication.

Author: EMG C3D Analyzer Team
Date: 2025-08-14
"""

import hashlib
import hmac
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class WebhookSecurity:
    """Webhook signature verification service
    
    Provides secure HMAC-SHA256 signature verification
    following industry best practices.
    """

    def verify_signature(
        self,
        payload: bytes,
        signature: str,
        secret: str
    ) -> bool:
        """Verify webhook signature using HMAC-SHA256
        
        Args:
            payload: Raw request body bytes
            signature: Signature from webhook header
            secret: Webhook secret key
            
        Returns:
            bool: True if signature is valid
        """
        if not payload or not signature or not secret:
            logger.warning("Missing required parameters for signature verification")
            return False

        try:
            # Generate expected signature
            expected_signature = hmac.new(
                secret.encode("utf-8"),
                payload,
                hashlib.sha256
            ).hexdigest()

            # Handle different signature formats
            # Supabase format: "sha256=<hash>"
            # Direct format: "<hash>"
            if signature.startswith("sha256="):
                provided_signature = signature[7:]  # Remove "sha256=" prefix
            else:
                provided_signature = signature

            # Constant-time comparison to prevent timing attacks
            is_valid = hmac.compare_digest(expected_signature, provided_signature)

            if not is_valid:
                logger.warning("Invalid webhook signature detected")
            else:
                logger.debug("Webhook signature verified successfully")

            return is_valid

        except Exception as e:
            logger.error(f"Signature verification error: {e!s}")
            return False

    def generate_signature(self, payload: bytes, secret: str) -> str:
        """Generate HMAC-SHA256 signature for payload
        
        Args:
            payload: Raw payload bytes
            secret: Webhook secret key
            
        Returns:
            str: Generated signature
        """
        if not payload or not secret:
            raise ValueError("Payload and secret are required")

        signature = hmac.new(
            secret.encode("utf-8"),
            payload,
            hashlib.sha256
        ).hexdigest()

        return f"sha256={signature}"
