# React Naming Conventions

**Version 1.0.0**

> **Note:**
> This document is for agents and LLMs to follow when creating, renaming,
> or refactoring React files and components. Ensures consistent naming
> across the codebase.

---

## Abstract

Naming conventions for React projects covering components, hooks, files, and folder organization. Consistent naming improves readability, collaboration, and maintainability.

---

## Table of Contents

1. [Component Naming](#1-component-naming) — **HIGH**
   - 1.1 [Use PascalCase for Component Names](#11-use-pascalcase-for-component-names)
   - 1.2 [Use Descriptive Component Names](#12-use-descriptive-component-names)
   - 1.3 [Use Category Prefixes for Organization](#13-use-category-prefixes-for-organization)
   - 1.4 [Don't Repeat Parent Folder in Component Names](#14-dont-repeat-parent-folder-in-component-names)
2. [File & Folder Naming](#2-file--folder-naming) — **HIGH**
   - 2.1 [File Name Must Match Primary Export](#21-file-name-must-match-primary-export)
3. [Hook Naming](#3-hook-naming) — **MEDIUM**
   - 3.1 [Hooks Use "use" Prefix, HOCs Use "with" Prefix](#31-hooks-use-use-prefix-hocs-use-with-prefix)
4. [Folder Structure](#4-folder-structure) — **MEDIUM**
   - 4.1 [Organize by Feature, Avoid Single-File Directories](#41-organize-by-feature-avoid-single-file-directories)

---

## 1. Component Naming

**Impact: HIGH**

### 1.1 Use PascalCase for Component Names

Every word in a React component name starts with a capital letter, no spaces between words.

```tsx
// Correct
const UserProfile = () => <div>Profile</div>;
const ShoppingCart = () => <div>Cart</div>;
const NavigationBar = () => <nav>Menu</nav>;
```

### 1.2 Use Descriptive Component Names

Choose names that clearly indicate the component's purpose. Avoid generic names.

| Avoid | Prefer |
|-------|--------|
| `Button` | `LoginButton` |
| `Card` | `ProductCard` |
| `Item` | `OrderItem` |

**Exception:** Base UI library components (shadcn/ui) use generic names intentionally as reusable primitives.

### 1.3 Use Category Prefixes for Organization

In shared component directories, prefixes help organize by role:

| Prefix | Category | Examples |
|--------|----------|---------|
| (none) | Feature-specific | `LoginForm`, `ProductCard` |
| UI | Base UI primitives | `UIButton`, `UICard` |
| Layout | Layout containers | `LayoutHeader`, `LayoutSidebar` |
| Form | Form elements | `FormInput`, `FormSelect` |

### 1.4 Don't Repeat Parent Folder in Component Names

The directory path already provides context. Don't duplicate it in the filename.

```
# Incorrect
features/planner/components/PlannerHeader.tsx
features/planner/components/PlannerSidebar.tsx

# Correct
features/planner/components/Header.tsx
features/planner/components/Sidebar.tsx
```

---

## 2. File & Folder Naming

**Impact: HIGH**

### 2.1 File Name Must Match Primary Export

| Primary export | File naming | Example |
|----------------|-------------|---------|
| Component | PascalCase `.tsx` | `UserProfile.tsx` → `UserProfile` |
| Hook | camelCase `.ts` | `useAuth.ts` → `useAuth` |
| Utility functions | camelCase or kebab-case `.ts` | `apiClient.ts`, `view-model.ts` |
| Types only | camelCase or kebab-case `.ts` | `types.ts`, `models.ts` |
| Constants/config | camelCase or kebab-case `.ts` | `env.ts`, `data-source.ts` |

---

## 3. Hook Naming

**Impact: MEDIUM**

### 3.1 Hooks Use "use" Prefix, HOCs Use "with" Prefix

- Hooks: `useAuth`, `useCounter`, `useLocalStorage`
- HOCs: `withAuth`, `withLoading`, `withTheme`
- Hook files: camelCase matching the hook name (`useAuth.ts`, not `use-auth.ts`)

---

## 4. Folder Structure

**Impact: MEDIUM**

### 4.1 Organize by Feature, Avoid Single-File Directories

```
# Correct: flat feature structure
features/auth/
├── api.ts
├── types.ts
├── useAuth.ts
└── LoginForm.tsx
```

**Rule of thumb:** If a subdirectory contains only 1 file, flatten it. Only create subdirectories with 3+ related files.
