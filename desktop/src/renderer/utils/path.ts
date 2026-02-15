/** Extract the last folder/file name from an absolute path. */
export function folderName(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}
