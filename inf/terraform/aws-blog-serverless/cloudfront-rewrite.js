// Maps clean viewer URLs onto the Next.js static-export layout, which emits
// flat files: /blogs -> blogs.html, /blogs/<slug> -> blogs/_.html (a single
// client shell), /login -> login.html, /admin -> admin.html, etc.
function handler(event) {
  var req = event.request;
  var uri = req.uri;

  // Root and the blog home both serve the exported blog list page.
  if (uri === "/" || uri === "/blogs" || uri === "/blogs/") {
    req.uri = "/blogs.html";
    return req;
  }

  // Any blog detail path maps to the single exported client shell, which reads
  // the real slug from the URL at runtime and fetches the post.
  if (/^\/blogs\/.+/.test(uri)) {
    req.uri = "/blogs/_.html";
    return req;
  }

  // Real files (assets, _next chunks, images, the .html targets) pass through.
  if (uri.includes(".")) {
    return req;
  }

  // Every other clean route -> its exported <route>.html file.
  if (uri.endsWith("/")) {
    uri = uri.slice(0, -1);
  }
  req.uri = uri + ".html";
  return req;
}
