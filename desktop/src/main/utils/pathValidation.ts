import path from "path";
import os from "os";

const homeDir = os.homedir();

/**
 * Validate and resolve a path, ensuring it falls within an allowed root.
 *
 * Defense-in-depth:
 * 1. Resolve to absolute path (handles relative paths, symlinks in prefix)
 * 2. Verify the resolved path starts with the user's home directory
 * 3. Reject null bytes (common injection vector)
 *
 * Throws if the path is outside the allowed root.
 */
export function validatePath(inputPath: string, allowedRoot?: string): string {
  if (!inputPath || typeof inputPath !== "string") {
    throw new Error("Invalid path: must be a non-empty string");
  }

  // Reject null bytes — common path injection vector
  if (inputPath.includes("\0")) {
    throw new Error("Invalid path: contains null bytes");
  }

  const resolved = path.resolve(inputPath);
  const root = allowedRoot ? path.resolve(allowedRoot) : homeDir;

  // Ensure resolved path is within the allowed root
  // Use trailing separator to prevent prefix attacks (/home/user2 matching /home/user)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(
      `Path access denied: ${resolved} is outside allowed root ${root}`
    );
  }

  return resolved;
}

/**
 * Validate a URL scheme for safe external opening.
 * Only allows http: and https: schemes.
 */
export function validateExternalUrl(url: string): string {
  if (!url || typeof url !== "string") {
    throw new Error("Invalid URL: must be a non-empty string");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `URL scheme not allowed: ${parsed.protocol} — only http: and https: are permitted`
    );
  }

  return url;
}
