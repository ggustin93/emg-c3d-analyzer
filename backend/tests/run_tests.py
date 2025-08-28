#!/usr/bin/env python3
"""GHOSTLY+ EMG Analyzer Test Runner.

================================

This script runs all tests for the GHOSTLY+ EMG Analyzer backend.
It provides a summary of test results and can be used to verify
that the application works correctly before and after changes.

Usage:
    python run_tests.py [--verbose]
"""

import argparse
import sys
import unittest
from pathlib import Path

# Get the absolute path to the project root directory
PROJECT_ROOT = str(Path(__file__).resolve().parents[2])

# Add the project root to the Python path
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Also add the parent directory (backend) to the path
BACKEND_DIR = str(Path(__file__).resolve().parent.parent)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


class Colors:
    """ANSI color codes for terminal output."""

    HEADER = "\033[95m"
    OKBLUE = "\033[94m"
    OKCYAN = "\033[96m"
    OKGREEN = "\033[92m"
    WARNING = "\033[93m"
    FAIL = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"


def run_tests(verbose=False):
    """Run all tests and return the test result."""
    # Discover and run all tests
    test_loader = unittest.TestLoader()
    test_suite = test_loader.discover(Path(__file__).parent.resolve(), pattern="test_*.py")

    # Run the tests with the specified verbosity
    verbosity = 2 if verbose else 1
    test_runner = unittest.TextTestRunner(verbosity=verbosity)
    test_result = test_runner.run(test_suite)

    return test_result


def print_summary(test_result):
    """Print a summary of the test results."""
    header = f"{Colors.BOLD}{'=' * 28} TEST SUMMARY {'=' * 28}{Colors.ENDC}"
    print(f"\n{header}")

    run = f"{Colors.OKBLUE}Tests run: {test_result.testsRun}{Colors.ENDC}"
    failures = f"{Colors.FAIL}Failures: {len(test_result.failures)}{Colors.ENDC}"
    errors = f"{Colors.FAIL}Errors: {len(test_result.errors)}{Colors.ENDC}"
    skipped = f"{Colors.WARNING}Skipped: {len(test_result.skipped)}{Colors.ENDC}"

    print(f"{run}, {failures}, {errors}, {skipped}")

    if test_result.failures:
        print(f"\n{Colors.BOLD}{Colors.FAIL}FAILURES:{Colors.ENDC}")
        for i, (test, traceback) in enumerate(test_result.failures, 1):
            print(f"  {i}. {test.id()}")
            # Print last line of traceback for conciseness
            print(f"     {Colors.FAIL}↳ {traceback.splitlines()[-1]}{Colors.ENDC}")

    if test_result.errors:
        print(f"\n{Colors.BOLD}{Colors.FAIL}ERRORS:{Colors.ENDC}")
        for i, (test, traceback) in enumerate(test_result.errors, 1):
            print(f"  {i}. {test.id()}")
            print(f"     {Colors.FAIL}↳ {traceback.splitlines()[-1]}{Colors.ENDC}")

    print(f"{Colors.BOLD}{'=' * 70}{Colors.ENDC}")

    # This part is now handled by the shell script, but we keep it for direct runs
    if test_result.wasSuccessful():
        print(f"\n{Colors.BOLD}{Colors.OKGREEN}✅ ALL TESTS PASSED!{Colors.ENDC}")
    else:
        print(f"\n{Colors.BOLD}{Colors.FAIL}❌ TESTS FAILED!{Colors.ENDC}")


def main():
    """Parse arguments and run tests."""
    parser = argparse.ArgumentParser(description="Run GHOSTLY+ EMG Analyzer tests")
    parser.add_argument("--verbose", action="store_true", help="Show verbose test output")
    args = parser.parse_args()

    print("Running GHOSTLY+ EMG Analyzer tests...")
    print(f"Python path: {sys.path[:3]}")
    test_result = run_tests(verbose=args.verbose)
    print_summary(test_result)

    # Return non-zero exit code if tests failed
    return 0 if test_result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
