---
name: react-naming-conventions
description: React project naming conventions for components, hooks, files, and folder structure. Use when creating, renaming, or refactoring React files and components to ensure consistent naming across the codebase.
license: MIT
metadata:
  author: keming
  version: "1.0.0"
---

# React Naming Conventions

Naming conventions for React projects covering components, hooks, files, and folder organization. Consistent naming improves readability, collaboration, and maintainability.

## When to Apply

Reference these guidelines when:
- Creating new React components or hooks
- Renaming or refactoring existing files
- Organizing project folder structure
- Reviewing code for naming consistency

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Component Naming | HIGH | `component-` |
| 2 | File & Folder Naming | HIGH | `file-` |
| 3 | Hook Naming | MEDIUM | `hook-` |
| 4 | Folder Structure | MEDIUM | `folder-` |

## Quick Reference

### 1. Component Naming (HIGH)

- `component-pascal-case` - Always use PascalCase for component names
- `component-descriptive-names` - Use meaningful names that explain purpose, avoid generic names
- `component-category-prefix` - Use prefixes to organize by category (UI, Layout, Form, Auth)
- `component-no-redundant-prefix` - Don't repeat the parent folder name in the component name

### 2. File & Folder Naming (HIGH)

- `file-match-export` - File name must match the primary exported component or hook name
- `file-component-pascal` - Component files use PascalCase: `UserProfile.tsx`
- `file-hook-camel` - Hook files use camelCase matching the hook: `useAuth.ts`
- `file-utility-camel-or-kebab` - Utility/logic files use camelCase or kebab-case: `apiClient.ts`, `view-model.ts`

### 3. Hook Naming (MEDIUM)

- `hook-use-prefix` - Always prefix hooks with `use`: `useAuth`, `useCounter`
- `hook-hoc-with-prefix` - HOCs use `with` prefix: `withAuth`, `withLoading`

### 4. Folder Structure (MEDIUM)

- `folder-feature-based` - Organize by feature, not by file type
- `folder-no-single-file-dirs` - Don't wrap a single file in its own directory
- `folder-colocate` - Keep related files together within feature directories

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/component-pascal-case.md
rules/file-match-export.md
```

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
