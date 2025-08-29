
# CLAUDE.md — Frontend & UX/UI Guidelines

Refer to this document for modern frontend development and design principles. For general software engineering guidance (KISS, DRY, SOLID) and project context, see the main CLAUDE.md in project root.

This document merges **frontend engineering** (React, TypeScript) and **UX/UI design** (Tailwind, Shadcn UI) best practices to support the creation of scalable, maintainable, and accessible user-facing applications.

---

## 1/ Mission

**Frontend Engineer:** Build performant, accessible, and maintainable user interfaces with an excellent developer experience.

**UX/UI Designer:** Create an intuitive, consistent, and accessible user experience through a practical and reusable design system.

---

## 2/ Core Recommendations

### 2.1 Code & Logic

1.  **Build Small, Composable Components (SRP)**
    Components should do one thing well. Place generic, reusable components in `/components` and compose them into feature-specific components within `/features`.

2.  **Use Custom Hooks for Shared Logic (DRY)**
    Extract reusable logic that doesn't render JSX into custom hooks to avoid repetition.

3.  **Separate Client State from Server Cache**
    *   **UI State** (e.g., modals, themes) → `useState` or a simple state manager like Zustand.
    *   **API Data** (server state) → Use **TanStack Query** for robust caching, re-fetching, and mutations.

4.  **Strict TypeScript**
    Enable `"strict": true` in your `tsconfig.json`. This catches a majority of common bugs and improves long-term maintainability.

5.  **Co-locate Feature Logic**
    Keep components, hooks, tests, and types for a specific feature together within the same directory to make them self-contained and easier to manage.

6.  **Write User-Centric Tests**
    Use React Testing Library to test component behavior from a user's perspective, not its internal implementation details.

7.  **Prioritize Accessibility (a11y)**
    Use semantic HTML, manage focus, and add appropriate ARIA attributes. Test for keyboard navigation and screen reader compatibility.

8.  **Automate Formatting & Linting**
    Use Prettier and ESLint with pre-commit hooks to enforce a consistent style and catch issues automatically.

9.  **Lazy Load Routes & Heavy Components**
    Use `React.lazy()` and `Suspense` to code-split your application. This reduces the initial bundle size and improves load times.

10. **Handle All UI States Explicitly**
    Ensure every component that fetches data properly handles its `loading`, `error`, and `empty` states. Don't leave the user guessing.

### 2.2 Design & User Experience

11. **Use `tailwind.config.js` as the Source of Truth (DRY)**
    Your Tailwind config is the bridge between design and code. Map all design tokens—colors, fonts, spacing, and shadows—from Figma (or other tools) directly into your config.

12. **Build a Reusable Component System**
    Focus on creating flexible, composable components (e.g., in Storybook) rather than designing static, one-off pages.

13. **Mobile-First & Responsive (KISS)**
    Design for the smallest screen first and then scale up, adding breakpoints where the design naturally breaks. This ensures a solid experience on all devices.

14. **Maintain a Consistent Spacing System**
    Adhere to a strict spacing scale (e.g., a 4px or 8px grid) for all margins, paddings, and layout gaps. This creates visual harmony and predictability.

15. **Provide Immediate & Clear Feedback**
    Every user action should have an immediate and obvious reaction, whether it's a loading spinner, a toast notification, or a simple button state change.

16. **Design for All Interaction States**
    Don't forget to define styles for `hover`, `focus`, `active`, `disabled`, `loading`, and `error` states for all interactive elements.

17. **Favor Clarity Over Cleverness (KISS)**
    An interface should be self-explanatory. Use standard UI patterns and clear labels that users already understand.

18. **Prototype and Test Key User Flows**
    Before high-fidelity design or implementation, validate critical user journeys with simple, interactive prototypes to catch usability issues early.

---

## 3/ Recommended Frontend File Organization

```text
/src
├── api/               # Typed API calls & data fetching logic
├── components/        # Global, reusable "dumb" UI components
│   ├── ui/            # Primitives like Button, Card (from shadcn)
│   └── layout/        # Header, Sidebar, Footer, etc.
├── features/          # Self-contained feature modules
│   └── analysis-dashboard/
│       ├── components/ # Feature-specific components
│       ├── hooks/      # Feature-specific hooks
│       ├── index.tsx   # Main feature view/entry point
│       └── types.ts    # Feature-specific types
├── hooks/             # Global, shared hooks (e.g., useAuth, useTheme)
├── lib/               # Global utilities (e.g., date formatters)
├── providers/         # App-wide context providers
├── store/             # Global client state (e.g., Zustand)
├── styles/            # Global CSS styles
└── App.tsx            # Main app router and provider setup
```

---

## 4/ Guiding Principles

*   **KISS (Keep It Simple, Stupid):** Strive for simplicity in components, state, and logic. If a simpler solution exists, choose it.
*   **DRY (Don't Repeat Yourself):** Avoid duplicating code and styles. Use hooks, components, and Tailwind tokens to stay efficient.
*   **SRP (Single Responsibility Principle):** Each component should have one primary job.
*   **Accessibility First:** Design and build for everyone. Accessibility is a core requirement, not an afterthought.
*   **Consistency is Key:** A consistent experience across the app—in design, behavior, and terminology—builds trust and reduces cognitive load for the user.

---

## 5/ Available tools in Claude Code CLI

Your AI agent has access to the following MCP (Model Context Protocol) tools to improve automation, screenshots, and design iteration:

- **Playwright MCP** : Browser automation for tests and screenshots. Execute JavaScript in a real browser. Analyze structure using accessibility data.
- **Context7 MCP** : Up-to-date documentation and code examples. Structured access to APIs and libraries.
- **Shadcn UI MCP** : Integrates Shadcn UI components directly into your AI workflow. Allows your agent to generate, modify, and iterate on component designs programmatically.Ensures that UI updates remain consistent with the design system and Tailwind config.