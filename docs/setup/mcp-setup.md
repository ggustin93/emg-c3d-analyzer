# Setting Up Claude Code MCP Servers Globally

## Global MCP Configuration

To set up MCP servers globally for Claude Code (not project-specific), follow these steps:

### Option 1: Using Claude MCP Commands

```bash
# Add servers individually
claude mcp add context7 npx -y @upstash/context7-mcp@latest
claude mcp add puppeteer npx -y @modelcontextprotocol/server-puppeteer
claude mcp add perplexity-mcp uvx perplexity-mcp
claude mcp add supabase npx -y @supabase/mcp-server-supabase@latest --access-token YOUR_TOKEN
```

### Option 2: Import from Claude Desktop (if you have it installed)

```bash
claude mcp add-from-claude-desktop
```

### Option 3: Manual Configuration

Claude Code stores global MCP configuration in:
- **macOS/Linux**: `~/.config/claude/mcp_servers.json`
- **Windows**: `%APPDATA%\claude\mcp_servers.json`

Create or edit this file directly:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    },
    "perplexity-mcp": {
      "env": {
        "PERPLEXITY_API_KEY": "YOUR_API_KEY",
        "PERPLEXITY_MODEL": "sonar"
      },
      "command": "uvx",
      "args": ["perplexity-mcp"]
    }
  }
}
```

## Environment Variables for Security

### Option 1: System Environment Variables

Set environment variables in your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export PERPLEXITY_API_KEY="your-api-key"
export SUPABASE_ACCESS_TOKEN="your-token"
```

### Option 2: Use a Global .env File

Create `~/.claude/.env`:
```
PERPLEXITY_API_KEY=your-api-key
SUPABASE_ACCESS_TOKEN=your-token
```

Then load it in your shell profile:
```bash
# Add to ~/.bashrc or ~/.zshrc
if [ -f ~/.claude/.env ]; then
    export $(cat ~/.claude/.env | grep -v '^#' | xargs)
fi
```

## Project-Specific vs Global MCP

- **Global**: Configured via `claude mcp` commands or `~/.config/claude/mcp_servers.json`
- **Project**: `.claude/mcp_servers.json` in your project directory
- **Priority**: Project-specific configurations override global ones

## Verify Your Configuration

```bash
# List all configured MCP servers
claude mcp list

# Get details about a specific server
claude mcp get context7

# Test an MCP server (in Claude Code)
# Use the server in a conversation to verify it's working
```

## Common MCP Servers

1. **context7**: Library documentation and code examples
2. **puppeteer**: Browser automation and web scraping
3. **perplexity-mcp**: AI-powered web search
4. **supabase**: Database operations
5. **filesystem**: File system access
6. **github**: GitHub API integration

## Troubleshooting

If MCP servers aren't working:

1. Check if servers are listed: `claude mcp list`
2. Verify environment variables are set: `echo $PERPLEXITY_API_KEY`
3. Restart Claude Code after configuration changes
4. Check logs: `~/.claude/logs/`

## Security Best Practices

1. Never commit API keys to version control
2. Use environment variables for sensitive data
3. Add configuration files to `.gitignore`
4. Rotate API keys regularly
5. Use project-specific tokens when possible