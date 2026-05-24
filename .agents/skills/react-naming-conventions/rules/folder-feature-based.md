---
title: Organize by Feature, Avoid Single-File Directories
impact: MEDIUM
impactDescription: reduces navigation depth and improves discoverability
tags: naming, folders, organization
---

## Organize by Feature, Avoid Single-File Directories

Group files by feature, not by file type. Don't create directories that contain only one file.

**Incorrect (organized by type, single-file directories):**

```
src/
├── components/
│   ├── auth/
│   │   └── LoginForm.tsx
│   └── dashboard/
│       └── DashboardHeader.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useDashboard.ts
├── api/
│   ├── authApi.ts          ← only one file
│   └── dashboardApi.ts
└── types/
    ├── auth.ts             ← only one file
    └── dashboard.ts
```

**Correct (organized by feature, flat when small):**

```
src/
├── features/
│   ├── auth/
│   │   ├���─ api.ts
│   │   ├── types.ts
│   │   ├── useAuth.ts
│   │   └── LoginForm.tsx
│   └── dashboard/
│       ├── api.ts
│       ├── useDashboard.ts
│       └── DashboardHeader.tsx
├── components/
│   └── ui/                 ← shared UI primitives
└── lib/                    ← shared utilities
```

**Rule of thumb:** If a subdirectory contains only 1 file, flatten it. `features/auth/hooks/useAuth.ts` should be `features/auth/useAuth.ts`. Only create subdirectories when there are 3+ related files (e.g., `planner/components/` with 15 component files).
