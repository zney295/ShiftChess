const scope = self.registration.scope;
const cachePrefix = "shiftchess:" + scope + ":";
const cacheName = cachePrefix + BUILD_ID;
const index = new URL("index.html", scope).href;
const offlineFiles = new Set(FILES.map((file) => new URL(file, scope).href));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(
    [...offlineFiles].map((url) => new Request(url, { cache: "reload" })),
  )));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
      .map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  url.search = "";
  const navigation = request.mode === "navigate" && (url.href === scope || url.href === index);
  if (!navigation && !offlineFiles.has(request.url)) return;
  event.respondWith(caches.open(cacheName).then(async (cache) =>
    (await cache.match(navigation ? index : request.url, { ignoreVary: true })) ?? fetch(request),
  ));
});
