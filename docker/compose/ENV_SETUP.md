# Docker Environment Setup

This guide explains how to run the EMG C3D Analyzer using Docker containers for consistent development and deployment.

## Quick Start

```bash
# Start development environment
./start_dev_docker.sh up

# Rebuild after environment variable changes
./start_dev_docker.sh up --build

# Stop everything
./start_dev_docker.sh down
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- API Documentation: http://localhost:8080/docs

## Essential Information

### Environment Variables and Build Time

**Critical**: Frontend environment variables (VITE_*) are embedded during the Docker build process, not at runtime.

This means:
- Changes to VITE_* variables require rebuilding the Docker image
- The build process takes 2-5 minutes (TypeScript compilation + Vite bundling)
- Always use `--build` flag after modifying `.env` file

```bash
# After changing .env file
./start_dev_docker.sh up --build
```

### Build Process Expectations

When you see `[frontend builder 9/10] RUN npm run build` for several minutes, this is normal. The frontend build involves:
- TypeScript type checking
- JavaScript bundling and optimization
- Asset processing
- Production build generation

## Docker Management Commands

### Using the Wrapper Script (Recommended)

The `start_dev_docker.sh` script provides convenient commands with automatic environment variable handling:

| Command | Description | Use When |
|---------|-------------|----------|
| `./start_dev_docker.sh up` | Start services | Normal development |
| `./start_dev_docker.sh up --build` | Rebuild and start | After `.env` changes |
| `./start_dev_docker.sh down` | Stop services | End of work session |
| `./start_dev_docker.sh down --force` | Force stop | Ports are stuck |
| `./start_dev_docker.sh restart` | Restart services | Quick refresh |
| `./start_dev_docker.sh restart --build` | Rebuild and restart | Update with new code |
| `./start_dev_docker.sh logs` | View all logs | Debugging issues |
| `./start_dev_docker.sh logs frontend` | View specific service | Target debugging |
| `./start_dev_docker.sh status` | Check container status | Verify running state |
| `./start_dev_docker.sh clean` | Clean Docker resources | Free up disk space |

### Manual Docker Commands

If you prefer direct Docker Compose commands:

```bash
# From project root - Note the required --env-file flag
docker compose --env-file .env -f docker/compose/docker-compose.dev.yml up -d
docker compose --env-file .env -f docker/compose/docker-compose.dev.yml up -d --build
docker compose --env-file .env -f docker/compose/docker-compose.dev.yml down
docker compose --env-file .env -f docker/compose/docker-compose.dev.yml logs
```

**Important**: The `--env-file .env` flag is required for environment variables to load correctly.

## Environment Variables

### Required Variables

Create a `.env` file in the project root with:

```bash
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Frontend Variables (Must match backend values)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8080

# Application Settings
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO
SECRET_KEY=your-secret-key
WEBHOOK_SECRET=your-webhook-secret
```

### Variable Loading Process

1. **Build Time** (Frontend):
   - VITE_* variables are embedded into the JavaScript bundle
   - Changes require image rebuild with `--build` flag

2. **Runtime** (Backend):
   - Backend variables can be updated without rebuild
   - Restart container to apply changes

3. **Priority Order**:
   - Docker Compose `environment:` section (highest)
   - `.env` file values
   - Shell environment variables (lowest)

## Troubleshooting

### Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Variables not loading** | "variable is not set" warnings | Use `--env-file .env` flag or wrapper script |
| **Frontend can't connect to Supabase** | `localhost:54321` errors | Rebuild with `--build` after setting VITE_* variables |
| **Build seems stuck** | Long wait at `npm run build` | Normal - wait 2-5 minutes for completion |
| **Port already in use** | "bind: address already in use" | Use `./start_dev_docker.sh down --force` |
| **Out of disk space** | Build failures | Run `./start_dev_docker.sh clean` then `docker system prune -a` |

### Checking Environment Variables

```bash
# Verify what Docker Compose sees
docker compose --env-file .env -f docker/compose/docker-compose.dev.yml config

# Check running container environment
docker exec emg-frontend-dev env | grep VITE
docker exec emg-backend-dev env | grep SUPABASE
```

### Cleanup and Maintenance

```bash
# Basic cleanup (removes stopped containers, unused networks)
./start_dev_docker.sh clean

# Aggressive cleanup (removes ALL unused images)
docker system prune -a

# Remove unused volumes
docker volume prune

# Full reset
docker system prune -a --volumes
```

## Advanced Configuration

### Development vs Production

The repository includes multiple Docker Compose files:
- `docker-compose.dev.yml` - Local development with hot reload
- `docker-compose.staging.yml` - Staging deployment
- `docker-compose.production.yml` - Production deployment

### Using Different Environment Files

For production deployments, you can use separate environment files:

```bash
# Create environment-specific files
cp .env .env.production
cp .env .env.staging

# Use specific file
docker compose --env-file .env.production -f docker/compose/docker-compose.production.yml up -d
```

### Coolify Deployment

When deploying with Coolify:
1. Compose files should use `context: .` (not `../..`)
2. Environment variables are managed through Coolify's UI
3. Build context is from project root

## Services Architecture

The Docker setup includes three main services:

1. **Frontend** (port 3000)
   - React application with Vite
   - nginx server in production mode
   - Hot reload in development

2. **Backend** (port 8080)
   - FastAPI application
   - Python 3.11 with scientific libraries
   - Auto-reload in development

3. **Redis** (port 6380)
   - Caching layer
   - Session storage
   - Background job queue

## Getting Help

If you encounter issues:

1. Check the logs: `./start_dev_docker.sh logs [service]`
2. Verify environment variables are set correctly
3. Ensure Docker Desktop is running and has sufficient resources
4. Try a clean rebuild: `./start_dev_docker.sh clean` then `up --build`

For more information, see the main project documentation or open an issue on GitHub.