import {
  RECURRING_CAUSE_MIN_OCCURRENCES,
  isPostmortemActionOverdue,
  type PostmortemActionStatus,
  type PostmortemCauseCategory,
  type PostmortemCauseType,
  type PostmortemLessonType,
  type PostmortemStatus,
} from "@eops/shared/postmortems";

/**
 * Agregações da página de insights. Puro por construção: recebe as linhas já
 * carregadas e devolve contagens reais, sem estimativa nem preenchimento.
 */

export interface CauseInsightRow {
  postmortemId: string;
  type: PostmortemCauseType;
  category: PostmortemCauseCategory;
  statement: string;
}

export interface LessonInsightRow {
  type: PostmortemLessonType;
  category: PostmortemCauseCategory | null;
}

export interface ActionInsightRow {
  status: PostmortemActionStatus;
  dueAt: Date | null;
}

export interface PostmortemInsightRow {
  id: string;
  status: PostmortemStatus;
  createdAt: Date;
  publishedAt: Date | null;
  severity: string;
}

export interface LessonCount {
  key: string;
  count: number;
}

export function countBy<T, K extends string>(
  rows: readonly T[],
  key: (row: T) => K | null | undefined,
): Array<{ key: K; count: number }> {
  const counters = new Map<K, number>();
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    counters.set(value, (counters.get(value) ?? 0) + 1);
  }
  return [...counters.entries()]
    .map(([entryKey, count]) => ({ key: entryKey, count }))
    .sort(
      (left, right) =>
        right.count - left.count || String(left.key).localeCompare(String(right.key)),
    );
}

export function causesByCategory(causes: readonly CauseInsightRow[]) {
  return countBy(causes, (cause) => cause.category);
}

export function causesByType(causes: readonly CauseInsightRow[]) {
  return countBy(causes, (cause) => cause.type);
}

/**
 * Causas recorrentes: agrupadas por categoria + tipo e reportadas apenas quando
 * aparecem em dois ou mais postmortems distintos.
 */
export function recurringCauses(causes: readonly CauseInsightRow[]) {
  const groups = new Map<
    string,
    { category: PostmortemCauseCategory; type: PostmortemCauseType; postmortems: Set<string> }
  >();
  for (const cause of causes) {
    const key = `${cause.category}|${cause.type}`;
    const current =
      groups.get(key) ??
      { category: cause.category, type: cause.type, postmortems: new Set<string>() };
    current.postmortems.add(cause.postmortemId);
    groups.set(key, current);
  }
  return [...groups.values()]
    .filter((group) => group.postmortems.size >= RECURRING_CAUSE_MIN_OCCURRENCES)
    .map((group) => ({
      category: group.category,
      type: group.type,
      postmortemCount: group.postmortems.size,
    }))
    .sort(
      (left, right) =>
        right.postmortemCount - left.postmortemCount ||
        left.category.localeCompare(right.category),
    );
}

export function lessonsByType(lessons: readonly LessonInsightRow[]) {
  return countBy(lessons, (lesson) => lesson.type);
}

export function lessonsByCategory(lessons: readonly LessonInsightRow[]) {
  return countBy(lessons, (lesson) => lesson.category);
}

export function actionCounters(
  actions: readonly ActionInsightRow[],
  now: Date = new Date(),
) {
  return {
    open: actions.filter(
      (action) => action.status === "OPEN" || action.status === "IN_PROGRESS",
    ).length,
    done: actions.filter((action) => action.status === "DONE").length,
    cancelled: actions.filter((action) => action.status === "CANCELLED").length,
    overdue: actions.filter((action) => isPostmortemActionOverdue(action, now))
      .length,
  };
}

export function incidentsBySeverity(rows: readonly PostmortemInsightRow[]) {
  return countBy(rows, (row) => row.severity);
}

export function statusCounters(rows: readonly PostmortemInsightRow[]) {
  const counters = new Map<PostmortemStatus, number>();
  for (const row of rows)
    counters.set(row.status, (counters.get(row.status) ?? 0) + 1);
  return counters;
}

/** Média em horas entre criação e publicação; `null` sem publicações. */
export function averageTimeToPublishHours(
  rows: readonly PostmortemInsightRow[],
): number | null {
  const durations = rows
    .filter((row) => row.publishedAt !== null)
    .map(
      (row) =>
        (row.publishedAt!.getTime() - row.createdAt.getTime()) / 3_600_000,
    )
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (durations.length === 0) return null;
  const total = durations.reduce((sum, value) => sum + value, 0);
  return Math.round((total / durations.length) * 10) / 10;
}
