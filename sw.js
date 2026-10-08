const CACHE='bowling-tracker-v23-photo-picker';
const CORE=['./','./index.html','./leopard-print.svg?v=20261003-bg1','./bowling-header.svg?v=20261003-leopard2','./ball-pin.svg?v=20261002-icon1','./styles.css?v=20261003-bg1','./app.js?v=20261002-pdfheader1','./pdf-header.js?v=20261003-leopard2','./cloud-sync.js?v=20261002-cloud1','./manifest.webmanifest','./vendor/jspdf.umd.min.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bowling-tracker-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 e.respondWith(fetch(e.request,{cache:'no-store'}).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return resp;}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
