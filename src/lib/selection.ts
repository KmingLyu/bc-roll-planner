/**
 * 描述選取容量狀態，例如「還可再選 3 個卡池。」
 * @param unit - 含量詞的單位，例如 "個卡池"、"隻目標貓咪"
 */
export function describeSelectionCapacity(params: {
  count: number;
  limit: number;
  unit: string;
}) {
  const { count, limit, unit } = params;
  const remaining = Math.max(0, limit - count);

  if (count >= limit) {
    return `已達上限 ${limit} ${unit}，取消已選項目後才能更換。`;
  }
  if (count === 0) {
    return `最多可選 ${limit} ${unit}。`;
  }
  return `還可再選 ${remaining} ${unit}。`;
}

export function clampSelection<T>(values: T[], limit: number) {
  return [...new Set(values)].slice(0, limit);
}
