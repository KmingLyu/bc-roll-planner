---
title: File Name Must Match Primary Export
impact: HIGH
impactDescription: enables quick file location and prevents confusion
tags: naming, files
---

## File Name Must Match Primary Export

The file name should match the name of the primary exported component or hook.

**Incorrect (name mismatch):**

```
Note.tsx          → exports NotesBlock
Results/index.tsx → exports ResultTable
```

**Correct:**

```
NotesBlock.tsx    → exports NotesBlock
ResultTable.tsx   → exports ResultTable
useAuth.ts        → exports useAuth
```

**Rules by export type:**

| Primary export | File naming | Example |
|----------------|-------------|---------|
| Component | PascalCase `.tsx` | `UserProfile.tsx` → `UserProfile` |
| Hook | camelCase `.ts` | `useAuth.ts` → `useAuth` |
| Utility functions | camelCase or kebab-case `.ts` | `apiClient.ts`, `view-model.ts` |
| Types only | camelCase or kebab-case `.ts` | `types.ts`, `models.ts` |
| Constants/config | camelCase or kebab-case `.ts` | `env.ts`, `data-source.ts` |
