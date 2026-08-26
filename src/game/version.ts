function readGit() {
  const env = import.meta.env as { VITE_GIT_BRANCH?: string; VITE_GIT_SHA?: string };
  let branch = env.VITE_GIT_BRANCH || "beta";
  let sha = env.VITE_GIT_SHA || "";
  try {
    if (typeof __APP_BRANCH__ === "string" && __APP_BRANCH__) branch = __APP_BRANCH__;
    if (typeof __APP_SHA__ === "string" && __APP_SHA__) sha = __APP_SHA__;
  } catch {
    /* define may be missing in some bundles */
  }
  return { branch, sha: sha.slice(0, 7) };
}

const git = readGit();
export const APP_BRANCH = git.branch;
export const APP_SHA = git.sha;
export const APP_VERSION = git.sha ? `${git.branch} · ${git.sha}` : git.branch;
export const APP_COMMIT_URL = git.sha
  ? `https://github.com/rayony/maltese-snowwar/commit/${git.sha}`
  : "https://github.com/rayony/maltese-snowwar";
