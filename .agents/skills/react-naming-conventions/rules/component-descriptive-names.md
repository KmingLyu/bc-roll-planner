---
title: Use Descriptive Component Names
impact: HIGH
impactDescription: makes component purpose immediately clear
tags: naming, components, readability
---

## Use Descriptive Component Names

Choose names that clearly indicate the component's purpose. Avoid generic names that require reading the code to understand.

**Incorrect (generic, unclear purpose):**

```tsx
const Button = () => <button>Submit</button>;
const Card = () => <div>...</div>;
const Item = () => <li>...</li>;
const Component = () => <div>...</div>;
const Widget = () => <div>...</div>;
```

**Correct (descriptive, purpose is clear):**

```tsx
const LoginButton = () => <button>Submit</button>;
const ProductCard = () => <div>...</div>;
const OrderItem = () => <li>...</li>;
const WeatherWidget = () => <div>...</div>;
const UserAvatar = () => <img />;
```

**Exception:** Base UI library components (e.g., shadcn/ui) use generic names like `Button`, `Card`, `Input` intentionally, because they are reusable primitives. Descriptive naming applies to feature-specific components built on top of these primitives.
