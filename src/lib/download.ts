export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadText(text: string, fileName: string) {
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), fileName);
}

/** "Mon D" for ISO timestamps or YYYY-MM-DD dates; "Not set" when empty. */
export function dateLabel(value: string | undefined | null) {
  return value
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00" : value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "Not set";
}
