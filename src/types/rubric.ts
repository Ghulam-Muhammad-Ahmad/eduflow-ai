export interface RubricLevel {
  level: string;
  points: number;
  description: string;
}

export interface RubricCriterion {
  name: string;
  max_points: number;
  levels: RubricLevel[];
}

export interface RubricJson {
  title?: string;
  criteria: RubricCriterion[];
}

export function parseRubricJson(raw: string): RubricJson | null {
  try {
    const trimmed = raw.trim().replace(/^```json?\s*|\s*```$/g, "");
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as RubricJson).criteria)) return null;
    const r = parsed as RubricJson;
    if (!r.criteria.every((c) => c && typeof c.name === "string" && Array.isArray(c.levels))) return null;
    return r;
  } catch {
    return null;
  }
}
