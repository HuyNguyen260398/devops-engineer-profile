// Maps clean viewer URLs onto the Next.js static-export layout served from the
// apex domain. The export is flat: / -> index.html (portfolio home),
// /blogs -> blogs.html, /blogs/<slug> -> blogs/_.html (a single client shell),
// /blogs/editor -> blogs/editor.html, /blogs/editor/<slug> -> blogs/editor/_.html,
// /blogs-draft -> blogs-draft.html,
// /blogs-draft/<slug> -> blogs-draft/_.html (a single client shell),
// /login -> login.html.
function handler(event) {
  var req = event.request;
  var uri = req.uri;

  // Real files (assets, _next chunks, images, the .html targets) pass through.
  if (uri.includes(".")) {
    return req;
  }

  // Normalize a trailing slash (except the root itself).
  if (uri.length > 1 && uri.endsWith("/")) {
    uri = uri.slice(0, -1);
  }

  // Root serves the portfolio home.
  if (uri === "" || uri === "/") {
    req.uri = "/index.html";
    return req;
  }

  // Editor-by-slug maps to its single exported client shell. Must be tested
  // before the generic /blogs/<slug> rule below.
  if (/^\/blogs\/editor\/.+/.test(uri)) {
    req.uri = "/blogs/editor/_.html";
    return req;
  }

  // The editor index is a real static route.
  if (uri === "/blogs/editor") {
    req.uri = "/blogs/editor.html";
    return req;
  }

  // Any other /blogs/<slug> maps to the blog detail client shell, which reads
  // the real slug from the URL at runtime.
  if (/^\/blogs\/.+/.test(uri)) {
    req.uri = "/blogs/_.html";
    return req;
  }

  // A /blogs-draft/<slug> maps to the draft-preview client shell (private,
  // AuthGuard-gated at runtime). Must be tested before the generic fallback so
  // "/blogs-draft" itself still falls through to /blogs-draft.html.
  if (/^\/blogs-draft\/.+/.test(uri)) {
    req.uri = "/blogs-draft/_.html";
    return req;
  }

  // Every remaining clean route (/blogs, /blogs-draft, /login, ...) -> <route>.html.
  req.uri = uri + ".html";
  return req;
}
