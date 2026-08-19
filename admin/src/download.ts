/** Handing a file to the browser. The only part of the export that needs a DOM. */
export function download(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoked on the next tick rather than immediately: Safari has not started
  // reading the blob by the time click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
