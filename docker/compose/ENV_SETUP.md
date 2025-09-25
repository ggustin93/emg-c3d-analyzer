# Docker Compose Environment Variables Setup

## Overview

This directory contains Docker Compose configurations for different deployment environments. Each environment can use either the main `.env` file or environment-specific configuration files.

## Environment File Resolution

Docker Compose looks for `.env` files in the following order:

1. **When running locally** (from `docker/compose/` directory):
   - Uses `../../.env` (project root `.env` file)
   - This is configured in `docker-compose.dev.yml`

2. **When deployed via Coolify** (compose files uploaded to project root):
   - Uses `.env` in the same directory as the compose file
   - This is why production/staging files use `context: .` instead of `../..`

## Configuration Options

### Option 1: Single .env File (Current Setup)
All environments use the main `.env` file in the project root:
- Simple setup, one source of truth
- Good for development and testing
- Environment-specific values set via `environment:` section in compose files

### Option 2: Environment-Specific Files (Production Ready)
Use separate `.env` files for each environment:
- `.env.development` - Development environment
- `.env.staging` - Staging environment  
- `.env.production` - Production environment

To switch to environment-specific files, update the `env_file:` directive in each compose file:
```yaml
env_file:
  - .env.staging  # Instead of .env
```

## File Locations

### For Local Development
- **Compose files**: `docker/compose/`
- **Env file**: Project root `.env`
- **Context**: `../..` (relative to compose file)

### For Coolify Deployment
- **Compose files**: Uploaded to project root
- **Env file**: `.env` in project root (or set via Coolify UI)
- **Context**: `.` (project root)

## Important Notes

1. **Build Context**: Coolify runs compose from project root, so `context: .` is correct
2. **Environment Variables Priority**:
   - Docker Compose `environment:` section (highest priority)
   - `.env` file specified in `env_file:`
   - Shell environment variables (lowest priority)

3. **Sensitive Values**: Never commit real credentials to version control. Use:
   - Coolify's environment variable UI for production
   - Local `.env` file (gitignored) for development

## Troubleshooting

### Variables Not Found
1. Check if `.env` file exists in the expected location
2. Verify file permissions (must be readable)
3. Check for typos in variable names
4. Use `docker compose config` to debug resolved values

### Different Values Than Expected
1. Check priority order (compose > env_file > shell)
2. Look for hardcoded values in `environment:` section
3. Verify which `.env` file is being loaded

### Coolify Specific Issues
1. Ensure environment variables are set in Coolify dashboard
2. Check build logs for missing build args
3. Verify compose file is in project root when uploaded