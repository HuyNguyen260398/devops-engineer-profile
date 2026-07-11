function handler(event) {
  var req = event.request;
  var uri = req.uri;
  if (uri === "/") {
    req.uri = "/blogs/index.html";
    return req;
  }
  // Blog detail paths (/blogs/<slug>/) map to the single exported client shell.
  var m = uri.match(/^\/blogs\/([^\/]+)\/?$/);
  if (m && m[1] !== "index.html") {
    req.uri = "/blogs/_/index.html";
    return req;
  }
  if (uri.endsWith("/")) {
    req.uri = uri + "index.html";
    return req;
  }
  // Extension-less path -> its exported index.html (App Router export layout).
  if (!uri.includes(".")) {
    req.uri = uri + "/index.html";
  }
  return req;
}
