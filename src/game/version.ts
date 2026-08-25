const branch = typeof __APP_BRANCH__ === "string" && __APP_BRANCH__ ? __APP_BRANCH__ : "dev";
const sha = typeof __APP_SHA__ === "string" ? __APP_SHA__.slice(0, 7) : "";

export const APP_BRANCH = branch;
export const APP_SHA = sha;
export const APP_VERSION = sha ? `${branch} · ${sha}` : branch;
export const APP_COMMIT_URL = sha
  ? `https://github.com/rayony/maltese-snowwar/commit/${sha}`
  : "https://github.com/rayony/maltese-snowwar";
