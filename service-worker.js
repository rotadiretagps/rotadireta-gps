const CACHE='rota-direta-gps';
const TILE_CACHE='rota-direta-gps-tiles';
const MAX_TILES=400;
const SHELL=['./','./roteirizador.html','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png','./icon-512-maskable.png'];
const LIBS=[
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
];
const LIB_HOSTS=/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net|cdn\.sheetjs\.com)\//;
const TILE_HOSTS=/^https:\/\/([a-c]\.tile\.openstreetmap\.org|server\.arcgisonline\.com)\//;

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>Promise.all(SHELL.concat(LIBS).map(url=>cache.add(url).catch(()=>null))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==TILE_CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function trimTiles(cache){
  const keys=await cache.keys();
  if(keys.length>MAX_TILES){
    await Promise.all(keys.slice(0,keys.length-MAX_TILES).map(k=>cache.delete(k)));
  }
}

async function tileStrategy(request){
  const cache=await caches.open(TILE_CACHE);
  const hit=await cache.match(request);
  const network=fetch(request).then(response=>{
    if(response&&(response.ok||response.type==='opaque')){
      cache.put(request,response.clone()).then(()=>trimTiles(cache));
    }
    return response;
  }).catch(()=>hit);
  return hit||network;
}

async function libStrategy(request){
  const cache=await caches.open(CACHE);
  const hit=await cache.match(request);
  if(hit)return hit;
  const response=await fetch(request);
  if(response&&response.ok)cache.put(request,response.clone());
  return response;
}

async function appStrategy(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request);
    if(response&&response.ok)cache.put(request,response.clone());
    return response;
  }catch(error){
    const hit=await cache.match(request,{ignoreSearch:true});
    if(hit)return hit;
    if(request.mode==='navigate'){
      const shell=await cache.match('./roteirizador.html');
      if(shell)return shell;
    }
    throw error;
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=request.url;
  if(TILE_HOSTS.test(url)){
    event.respondWith(tileStrategy(request));
    return;
  }
  if(LIB_HOSTS.test(url)){
    event.respondWith(libStrategy(request));
    return;
  }
  if(new URL(url).origin===self.location.origin){
    event.respondWith(appStrategy(request));
  }
});
