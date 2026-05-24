---
title: Use Category Prefixes for Component Organization
impact: MEDIUM
impactDescription: helps organize and locate components by their role
tags: naming, components, organization
---

## Use Category Prefixes for Component Organization

Prefix components by their category when it adds clarity, especially in shared component directories.

**Common prefixes:**

| Prefix | Category | Examples |
|--------|----------|---------|
| (none) | Feature-specific | `LoginForm`, `ProductCard` |
| UI | Base UI primitives | `UIButton`, `UICard`, `UIModal` |
| Layout | Layout containers | `LayoutHeader`, `LayoutSidebar` |
| Form | Form elements | `FormInput`, `FormSelect` |

**When to use:** In a shared `components/` directory where components from different categories coexist. Feature-specific components typically don't need prefixes because the feature directory provides context.

**When NOT to use:** Inside a feature directory. `features/planner/components/Header.tsx` doesn't need a `Planner` prefix — the directory already provides namespace.
