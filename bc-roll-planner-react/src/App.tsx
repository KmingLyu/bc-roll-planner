// src/App.tsx
import CorsTest from "./CorsTest";

/**
 * App 保持最單純：只渲染測試頁
 * 之後你做正式 UI（事件列表 / planner / simulator）再換掉這裡即可。
 */
export default function App() {
  return <CorsTest />;
}
