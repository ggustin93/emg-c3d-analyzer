#!/usr/bin/env bash

set -euo pipefail

show_help() {
  cat <<EOF
KISS runner for backend tests in Docker

Usage:
  ./run_tests_docker.sh [--e2e] [--] [pytest-args...]

Options:
  --e2e       Run only end-to-end tests (requires backend + Redis up)
  --help      Show this help

Examples:
  ./run_tests_docker.sh                     # run all non-e2e tests
  ./run_tests_docker.sh -- -k emg_analysis  # pass args to pytest
  ./run_tests_docker.sh --e2e               # run only e2e tests
EOF
}

# Detect docker compose command
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "docker compose not found. Please install Docker." >&2
  exit 1
fi

RUN_E2E=0
PYTEST_MARKER=(-m "not e2e")
PYTEST_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --e2e)
      RUN_E2E=1
      PYTEST_MARKER=(-m "e2e")
      shift
      ;;
    --help|-h)
      show_help
      exit 0
      ;;
    --)
      shift
      PYTEST_ARGS=("$@")
      break
      ;;
    *)
      # Forward unknown args to pytest
      PYTEST_ARGS+=("$1")
      shift
      ;;
  esac
done

echo "[tests] Bringing up required services..."

# Redis is used by the stack; start it first
$COMPOSE up -d redis

# e2e tests may hit the running API container
if [[ $RUN_E2E -eq 1 ]]; then
  $COMPOSE up -d backend
fi

echo "[tests] Running pytest in one-off backend container..."

# Install dev deps (pytest) and run tests
set +e
$COMPOSE run --rm backend sh -lc "pip install -q -r backend/requirements-dev.txt && pytest backend/tests ${PYTEST_MARKER[@]} -v ${PYTEST_ARGS[*]}"
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "[tests] Success"
else
  echo "[tests] Failed with exit code $EXIT_CODE"
fi

exit $EXIT_CODE


