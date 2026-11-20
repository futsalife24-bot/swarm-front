export type ReportEncounterState = "solo" | "coop" | undefined;

export function allowsReportMotion(state: ReportEncounterState) {
  return state === "solo";
}

export function advanceReportViewerTime(still: boolean, dt: number) {
  return still ? 0 : dt;
}
