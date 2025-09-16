import logging
import sys
from logging.config import dictConfig
from pathlib import Path

import structlog
from pythonjsonlogger import jsonlogger


def setup_logging(log_level: str = "INFO"):
    """
    Set up structured logging using structlog and python-json-logger.
    Logs to both console and files with timestamps.
    """
    timestamper = structlog.processors.TimeStamper(fmt="iso")

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        timestamper,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    # Ensure logs directory exists - use /app/logs in Docker, local path otherwise
    # In Docker, the app runs from /app, and we have /app/logs created with proper permissions
    import os
    if os.path.exists('/app'):
        # Running in Docker container
        logs_dir = Path('/app/logs')
    else:
        # Running locally
        logs_dir = Path(__file__).parent.parent.parent / "logs"
    
    logs_dir.mkdir(exist_ok=True, parents=True)
    
    backend_log_file = logs_dir / "backend.log"
    error_log_file = logs_dir / "backend.error.log"

    # Configure logging for the application
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {
                    "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                    "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
                },
                "detailed": {
                    "format": "%(asctime)s [%(levelname)8s] %(name)s: %(message)s",
                    "datefmt": "%Y-%m-%d %H:%M:%S",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "json",
                    "stream": sys.stdout,
                },
                "file": {
                    "class": "logging.handlers.RotatingFileHandler",
                    "filename": str(backend_log_file),
                    "formatter": "detailed",
                    "maxBytes": 10485760,  # 10MB
                    "backupCount": 5,
                    "encoding": "utf8",
                },
                "error_file": {
                    "class": "logging.handlers.RotatingFileHandler",
                    "filename": str(error_log_file),
                    "formatter": "detailed",
                    "level": "ERROR",
                    "maxBytes": 10485760,  # 10MB
                    "backupCount": 5,
                    "encoding": "utf8",
                },
            },
            "loggers": {
                "": {
                    "handlers": ["console", "file", "error_file"],
                    "level": log_level.upper(),
                    "propagate": True,
                },
                "uvicorn": {
                    "handlers": ["console", "file"],
                    "level": log_level.upper(),
                    "propagate": False,
                },
                "uvicorn.access": {
                    "handlers": ["console", "file"],
                    "level": log_level.upper(),
                    "propagate": False,
                },
            },
        }
    )

    # Configure structlog to wrap the standard library logger
    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
