export const DEFAULT_TOOL_TEST_INPUT = '{\n  "location": "London"\n}';

export function normalizeToolTestInput(stored: string | undefined | null): string {
  const trimmed = stored?.trim();
  return trimmed ? trimmed : DEFAULT_TOOL_TEST_INPUT;
}
