---
title: Use PascalCase for Component Names
impact: HIGH
impactDescription: ensures consistent, professional component naming
tags: naming, components
---

## Use PascalCase for Component Names

Every word in a React component name starts with a capital letter, no spaces between words. This is the universal React convention and required by JSX.

**Incorrect:**

```tsx
// camelCase - not a valid component name in JSX
const userProfile = () => <div>Profile</div>;

// snake_case - non-standard
const user_profile = () => <div>Profile</div>;

// kebab-case - invalid in JavaScript
// const user-profile = () => <div>Profile</div>;
```

**Correct:**

```tsx
const UserProfile = () => <div>Profile</div>;
const ShoppingCart = () => <div>Cart</div>;
const NavigationBar = () => <nav>Menu</nav>;
```
