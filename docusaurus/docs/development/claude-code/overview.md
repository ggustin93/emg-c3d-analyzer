---
sidebar_position: 1
title: Claude Code Overview
---
https://www.youtube.com/watch?v=amEUIuBKwvg&t=383s 



# Agentic Development

AI-powered development workflows using Claude Code, Cursor IDE and SuperClaude framework.
## Tools 

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

## Project Configuration

### CLAUDE.md
Project instructions for Claude Code:
- Development principles
- Tech stack details
- Code patterns
- Testing requirements

## Best Practices

1. **Always verify AI output** - Don't blindly accept
2. **Maintain context** - Keep CLAUDE.md updated
3. **Test everything** - AI can make mistakes
4. **Review changes** - Understand what was generated

