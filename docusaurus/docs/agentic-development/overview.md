---
sidebar_position: 1
title: Agentic Development Overview
---

# Agentic Development

AI-powered development workflows using Claude Code and Cursor IDE.

## What is Agentic Development?

Development approach where AI agents assist with:
- Code generation and refactoring
- Test creation and validation
- Documentation maintenance
- Code review and optimization

## Tools We Use

### 🤖 [Claude Code](./claude-code/overview)
Command-line AI assistant with:
- Project context awareness
- MCP server integrations
- SuperClaude commands
- Specialized agents

### 💻 [Cursor IDE](./cursor/overview)
AI-powered IDE with:
- Inline code generation
- Multi-file editing
- AI chat interface
- Context-aware suggestions

### 🧪 [AI Testing](./testing/overview)
Automated test generation:
- Unit test creation
- Coverage improvement
- Mock generation
- E2E test scenarios

## Workflow Example

```mermaid
graph LR
    A[Requirements] --> B[Claude Code]
    B -->|Generate| C[Implementation]
    C --> D[Cursor IDE]
    D -->|Refine| E[Code Review]
    E --> F[AI Tests]
    F --> G[Documentation]
```

## Key Benefits

- **Speed**: 5-10x faster development
- **Quality**: Consistent code patterns
- **Coverage**: Comprehensive testing
- **Documentation**: Always up-to-date

## Project Configuration

### CLAUDE.md
Project instructions for Claude Code:
- Development principles
- Tech stack details
- Code patterns
- Testing requirements

### .cursorrules
Cursor IDE configuration:
- Code style preferences
- Framework patterns
- Security guidelines
- Performance requirements

## Best Practices

1. **Always verify AI output** - Don't blindly accept
2. **Maintain context** - Keep CLAUDE.md updated
3. **Test everything** - AI can make mistakes
4. **Review changes** - Understand what was generated

## Common Commands

### Claude Code
```bash
# Load project context
/sc:load

# Implement feature
/sc:implement "user authentication"

# Run tests
/sc:test --coverage

# Generate documentation
/sc:document
```

### Cursor
```
Cmd+K - Inline editing
Cmd+L - Chat with AI
Tab - Accept suggestion
Cmd+Shift+L - Add file context
```