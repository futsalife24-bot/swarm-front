/** Pick an unused server request ID even if a client has preclaimed IDs. */
export function frontAutomaticRequestId(processed: readonly string[]): string {
  const used = new Set(processed);
  let serial = 0;
  while (used.has(`auto:${serial}`)) serial++;
  return `auto:${serial}`;
}
