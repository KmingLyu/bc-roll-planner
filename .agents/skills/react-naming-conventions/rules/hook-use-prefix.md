---
title: Hooks Use "use" Prefix, HOCs Use "with" Prefix
impact: MEDIUM
impactDescription: instantly identifies hooks and HOCs by convention
tags: naming, hooks, hoc
---

## Hooks Use "use" Prefix, HOCs Use "with" Prefix

Hooks are always prefixed with `use` in camelCase. Higher-order components are prefixed with `with`.

**Hooks:**

```tsx
// File: useAuth.ts
export function useAuth() { /* ... */ }

// File: useCounter.ts
export function useCounter(initial: number) { /* ... */ }

// File: useLocalStorage.ts
export function useLocalStorage<T>(key: string) { /* ... */ }
```

**HOCs:**

```tsx
// File: withAuth.tsx
export function withAuth(Component) { /* ... */ }

// File: withLoading.tsx
export function withLoading(Component) { /* ... */ }
```

**File naming:** Hook files use camelCase matching the hook name. `useAuth.ts` not `use-auth.ts` or `hooks.ts`.
