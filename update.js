(function(){
var W=window;
if(!('serviceWorker'in navigator)||location.protocol==='file:')return;
var hadController=!!navigator.serviceWorker.controller;
var reloading=false;
var base=null;
var lastCheck=0;
function store(){try{return W.sessionStorage}catch(e){return null}}
function hash(t){var h=5381;for(var i=0;i<t.length;i++){h=((h<<5)+h+t.charCodeAt(i))|0}return h+':'+t.length}
function restore(){
var s=store();
if(!s)return;
var y=s.getItem('rotdScroll');
if(y===null)return;
s.removeItem('rotdScroll');
W.addEventListener('load',function(){setTimeout(function(){W.scrollTo(0,Number(y)||0)},80)})
}
function reload(){
if(reloading)return;
var s=store();
var last=s?Number(s.getItem('rotdReloadAt')||0):0;
if(Date.now()-last<60000)return;
reloading=true;
if(s){s.setItem('rotdScroll',String(W.scrollY||0));s.setItem('rotdReloadAt',String(Date.now()))}
W.location.reload()
}
function fetchSelf(){
return fetch(W.location.pathname,{cache:'no-store',credentials:'same-origin'}).then(function(r){return r.ok?r.text():null}).catch(function(){return null})
}
function check(reg){
var now=Date.now();
if(now-lastCheck<120000)return;
lastCheck=now;
if(reg)reg.update().catch(function(){});
fetchSelf().then(function(t){
if(t===null)return;
var h=hash(t);
if(base===null){base=h;return}
if(h!==base)reload()
})
}
restore();
navigator.serviceWorker.addEventListener('controllerchange',function(){
if(!hadController){hadController=true;return}
reload()
});
W.addEventListener('load',function(){
navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(function(reg){
fetchSelf().then(function(t){if(t!==null&&base===null)base=hash(t)});
document.addEventListener('visibilitychange',function(){if(!document.hidden)check(reg)});
W.addEventListener('online',function(){check(reg)});
setInterval(function(){if(!document.hidden)check(reg)},300000)
}).catch(function(){})
})
})();
