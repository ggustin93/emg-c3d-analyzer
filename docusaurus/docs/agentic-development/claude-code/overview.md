---
sidebar_position: 1
title: Claude Code Overview
---

# Claude Code

AI-powered development assistant with project awareness and MCP server integrations.

## Configuration

### CLAUDE.md Structure
```markdown
# Project Overview
- Core principles (KISS, DRY, YAGNI)
- Architecture decisions
- Tech stack details

# Development Workflow
- SuperClaude commands
- Testing requirements
- Documentation standards

# Technical Details
- API patterns
- Database schema
- Critical lessons learned
```

## MCP Servers

### Available Servers
1. **Context7** - Documentation lookup
2. **Sequential** - Complex analysis
3. **Supabase** - Database operations
4. **Playwright** - Browser testing
5. **Perplexity** - Web search
6. **Shadcn-ui** - UI components
7. **Serena** - Project memory

### Configuration
```bash
# Check MCP servers
claude mcp list

# Configure Supabase token
claude mcp configure supabase
```

## SuperClaude Commands

### Project Management
```bash
/sc:load          # Load project context
/sc:save          # Save session state
/sc:analyze       # Analyze codebase
```

### Development
```bash
/sc:implement "feature"   # Implement feature
/sc:test                 # Run tests
/sc:document             # Update docs
/sc:git                  # Version control
```

### Specialized Agents
```bash
@agent-frontend   # React/UI expert
@agent-backend    # FastAPI expert
@agent-security   # Security review
@agent-performance # Optimization
```

## Workflow Example

```bash
# 1. Load project
/sc:load

# 2. Analyze requirements
/sc:analyze "authentication system"

# 3. Implement feature
/sc:implement "JWT authentication with Supabase"

# 4. Test implementation
/sc:test --coverage

# 5. Document changes
/sc:document --type api

# 6. Save session
/sc:save
```

## Best Practices

### DO ✅
- Keep CLAUDE.md updated
- Use specific commands
- Verify generated code
- Test everything

### DON'T ❌
- Skip testing
- Ignore warnings
- Accept without review
- Forget to save context

## Critical Lessons

### Supabase Testing
```python
# NEVER use AsyncMock with Supabase
# ❌ Wrong
mock_service = AsyncMock()  # Causes coroutine errors

# ✅ Correct
mock_service = MagicMock()  # Supabase client is synchronous
```

### Direct vs FastAPI
- **Direct Supabase**: Simple CRUD, auth
- **FastAPI**: Complex processing, webhooks
- **Principle**: Use simplest tool that works