# FAQ Content Management Guide

## Overview
All FAQ content is now stored as individual markdown files in the `content/faq/` directory. This allows non-technical users to easily add and edit FAQ questions without touching any code.

## Directory Structure
```
content/faq/
├── getting-started/    # Basic platform information
├── patients/          # Patient management questions
├── sessions/          # Session analysis questions  
├── export/            # Data export questions
└── technical/         # Technical support questions
```

## Adding a New FAQ

1. Choose the appropriate category folder
2. Create a new markdown file (e.g., `my-question.md`)
3. Add the required frontmatter and content:

```markdown
---
question: "Your question here?"
category: "getting-started"
roles: ["all"]
keywords: ["keyword1", "keyword2"]
lastUpdated: 2025-01-20
---

Your answer content here using **markdown** formatting.

- Bullet points work
- **Bold** and *italic* text supported
- Links and lists are supported
```

## Frontmatter Fields

### Required Fields
- `question`: The FAQ question text
- `category`: One of: `getting-started`, `patients`, `sessions`, `export`, `technical`

### Optional Fields
- `roles`: Array of user roles who can see this FAQ
  - Options: `["all"]`, `["therapist"]`, `["researcher"]`, `["admin"]`
  - Default: `["all"]` (visible to everyone)
- `keywords`: Array of search keywords
  - Default: `[]`
- `lastUpdated`: Date in YYYY-MM-DD format

## Role-Based Visibility

Control who sees each FAQ using the `roles` field:

- `["all"]` - Everyone can see this FAQ
- `["therapist"]` - Only therapists can see this
- `["researcher"]` - Only researchers can see this
- `["admin"]` - Only administrators can see this
- `["therapist", "admin"]` - Multiple roles can be specified

## Markdown Formatting

You can use standard markdown formatting:

- **Bold**: `**text**`
- *Italic*: `*text*`
- Headers: `## Header`
- Lists: `- item` or `1. item`
- Links: `[text](url)`
- Code: `` `code` ``

## Examples

### Simple FAQ
```markdown
---
question: "How do I reset my password?"
category: "getting-started"
---

Click the "Forgot Password" link on the login page and follow the instructions.
```

### Role-Specific FAQ
```markdown
---
question: "How do I manage user accounts?"
category: "technical"
roles: ["admin"]
keywords: ["users", "administration", "accounts"]
---

As an admin, navigate to the Admin Dashboard and click on the Users tab.
```

## Best Practices

1. **Keep questions concise** - Make them easy to scan
2. **Use clear categories** - Place FAQs in the most relevant folder
3. **Add keywords** - Help users find answers through search
4. **Update dates** - Keep the `lastUpdated` field current
5. **Format for readability** - Use markdown to make answers easy to read

## Testing Your Changes

After adding or editing FAQ files:
1. Save the markdown file
2. The FAQ page will automatically load the new content
3. Check that your FAQ appears in the correct category
4. Test the search functionality with your keywords