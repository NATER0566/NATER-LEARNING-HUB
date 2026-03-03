const CACHE_NAME = "nater-hub-v1";

// All the files you want to load INSTANTLY
const assets = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/academy.html",
  "/library.html",
  "/admin.html",
  "/certificate.html",
  "/success.html",
  "/verify.html",
  "/verify-payment.html",
  "/logo.jpg"
];

// Install: Save the files to the phone storage
self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Nater Hub: Caching Shell Assets");
      return cache.addAll(assets);
    })
  );
});

// Activate: Delete old versions when you update the app
self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch: The "ASAP" Logic
self.addEventListener("fetch", (evt) => {
  const url = new URL(evt.request.url);

  // LOGIC: For Payment & Certificate verification, ALWAYS go to the Network first
  // This prevents students from seeing old cached "pending" statuses
  if (url.pathname.includes('/api/paystack/verify') || url.pathname.includes('/api/verify-certificate')) {
    evt.respondWith(
      fetch(evt.request).catch(() => caches.match(evt.request))
    );
    return;
  }

  // LOGIC: For everything else (HTML/CSS/Images), load from Cache for speed
  evt.respondWith(
    caches.match(evt.request).then((cacheRes) => {
      return cacheRes || fetch(evt.request).then((fetchRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // Dynamically cache new content if it's a GET request
          if (evt.request.method === "GET") {
            cache.put(evt.request.url, fetchRes.clone());
          }
          return fetchRes;
        });
      });
    })
  );
});