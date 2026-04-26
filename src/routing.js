const MODES = ["overview", "listen", "flow", "screen"];

export function getInitialModeFromLocation(locationLike = window.location) {
  const params = new URLSearchParams(locationLike.search ?? "");
  const queryMode = params.get("mode");
  if (MODES.includes(queryMode)) {
    return queryMode;
  }

  const pathMode = String(locationLike.pathname ?? "")
    .toLowerCase()
    .split("/")
    .filter(Boolean)
    .find((segment) => MODES.includes(segment));

  return pathMode ?? "overview";
}

export function getSurfaceFromLocation(locationLike = window.location) {
  const params = new URLSearchParams(locationLike.search ?? "");
  const surface = params.get("surface") ?? "";
  const pathname = String(locationLike.pathname ?? "").toLowerCase();

  if (surface === "debug" || pathname.includes("/debug")) {
    return "debug";
  }

  if (surface === "portable" || pathname.includes("/portable")) {
    return "portable";
  }

  return "main";
}
