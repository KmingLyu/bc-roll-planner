---
title: Don't Repeat Parent Folder in Component Names
impact: HIGH
impactDescription: eliminates noise and keeps names concise
tags: naming, components, folders
---

## Don't Repeat Parent Folder in Component Names

When a component lives inside a feature directory, don't repeat the feature name as a prefix. The directory path already provides context.

**Incorrect (redundant prefix):**

```
features/planner/components/PlannerHeader.tsx
features/planner/components/PlannerFooter.tsx
features/planner/components/PlannerSidebar.tsx
features/auth/components/AuthLoginForm.tsx
```

**Correct (directory provides namespace):**

```
features/planner/components/Header.tsx
features/planner/components/Footer.tsx
features/planner/components/Sidebar.tsx
features/auth/components/LoginForm.tsx
```

**Why:** Import statements already include the path. `import { Header } from "@/features/planner/components/Header"` is unambiguous. Adding `Planner` to the name doubles the information without benefit.

**Exception:** If two components from different features need to be used in the same file, use import aliases:

```tsx
import { Header as PlannerHeader } from "@/features/planner/components/Header";
import { Header as AuthHeader } from "@/features/auth/components/Header";
```
