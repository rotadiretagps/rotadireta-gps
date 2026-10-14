(function(){
var W=window;
function ls(){try{return W.localStorage}catch(e){return null}}
function legacyOn(){var s=ls();return !!s&&s.getItem('legacyMode')==='1'}
function xhr(method,url,headers,body){
return new Promise(function(resolve){
var x=new XMLHttpRequest();
var done=false;
function finish(v){if(!done){done=true;resolve(v)}}
try{x.open(method,url,true)}catch(e){return finish({status:0,body:null,error:{message:'Failed to fetch'}})}
x.timeout=30000;
for(var k in headers){if(headers.hasOwnProperty(k)&&headers[k]!=null)x.setRequestHeader(k,headers[k])}
x.onload=function(){
var t=x.responseText,j=null;
if(t){try{j=JSON.parse(t)}catch(e){j=null}}
finish({status:x.status,body:j,text:t,headers:x.getAllResponseHeaders()})
};
x.onerror=function(){finish({status:0,body:null,error:{message:'Failed to fetch'}})};
x.ontimeout=function(){finish({status:0,body:null,error:{message:'Failed to fetch'}})};
x.onabort=x.onerror;
try{x.send(body==null?null:body)}catch(e){finish({status:0,body:null,error:{message:'Failed to fetch'}})}
})
}
function errOf(r){
if(r.error)return r.error;
var b=r.body||{};
var m=b.error_description||b.msg||b.message||b.error||('HTTP '+r.status);
return{message:String(m),status:r.status,code:b.code||b.error_code,details:b.details,hint:b.hint}
}
function createClient(url,key,opts){
if(!legacyOn())return W.supabase&&W.supabase.createClient?W.supabase.createClient(url,key,opts):null;
url=url.replace(/\/+$/,'');
var ref=(url.match(/^https?:\/\/([^.]+)\./)||[])[1]||'app';
var storeKey='sb-'+ref+'-auth-token';
var listeners=[];
var current=null;
function load(){var s=ls();if(!s)return current;try{var v=s.getItem(storeKey);return v?JSON.parse(v):null}catch(e){return null}}
function save(sess){current=sess;var s=ls();if(!s)return;try{if(sess)s.setItem(storeKey,JSON.stringify(sess));else s.removeItem(storeKey)}catch(e){}}
function emit(ev,sess){for(var i=0;i<listeners.length;i++){try{listeners[i](ev,sess)}catch(e){}}}
function build(b){
if(!b||!b.access_token)return null;
var now=Math.floor(Date.now()/1000);
return{access_token:b.access_token,refresh_token:b.refresh_token,token_type:b.token_type||'bearer',expires_in:b.expires_in||3600,expires_at:b.expires_at||now+(b.expires_in||3600),user:b.user}
}
function authHeaders(token){return{'apikey':key,'Authorization':'Bearer '+(token||key),'Content-Type':'application/json'}}
function refresh(sess){
return xhr('POST',url+'/auth/v1/token?grant_type=refresh_token',authHeaders(),JSON.stringify({refresh_token:sess.refresh_token})).then(function(r){
if(r.status>=200&&r.status<300&&r.body){var n=build(r.body);save(n);emit('TOKEN_REFRESHED',n);return n}
if(r.status>=400&&r.status<500){save(null);emit('SIGNED_OUT',null)}
return null
})
}
function session(){
var s=current||load();
if(!s)return Promise.resolve(null);
current=s;
var now=Math.floor(Date.now()/1000);
if(s.expires_at&&s.expires_at-60<=now){
if(!navigator.onLine)return Promise.resolve(s);
return refresh(s).then(function(n){return n||(s.expires_at>now?s:null)})
}
return Promise.resolve(s)
}
function token(){return session().then(function(s){return s?s.access_token:null})}
function detect(){
var h=(W.location.hash||'').replace(/^#/,'');
if(!h||h.indexOf('access_token=')<0)return;
var p={};
h.split('&').forEach(function(kv){var i=kv.indexOf('=');if(i>0)p[decodeURIComponent(kv.slice(0,i))]=decodeURIComponent(kv.slice(i+1).replace(/\+/g,' '))});
if(!p.access_token)return;
var sess=build({access_token:p.access_token,refresh_token:p.refresh_token,expires_in:Number(p.expires_in)||3600,expires_at:Number(p.expires_at)||0,token_type:p.token_type});
xhr('GET',url+'/auth/v1/user',authHeaders(p.access_token)).then(function(r){
if(r.status>=200&&r.status<300&&r.body){
sess.user=r.body;
save(sess);
try{W.history.replaceState(null,'',W.location.pathname+W.location.search)}catch(e){}
emit(p.type==='recovery'?'PASSWORD_RECOVERY':'SIGNED_IN',sess)
}
})
}
function out(r,pick){
if(r.status>=200&&r.status<300)return{data:pick(r.body),error:null};
return{data:null,error:errOf(r)}
}
var auth={
getSession:function(){return session().then(function(s){return{data:{session:s},error:null}})},
getUser:function(){return session().then(function(s){return{data:{user:s?s.user:null},error:null}})},
signInWithPassword:function(c){
return xhr('POST',url+'/auth/v1/token?grant_type=password',authHeaders(),JSON.stringify({email:c.email,password:c.password})).then(function(r){
if(r.status>=200&&r.status<300&&r.body){var s=build(r.body);if(s&&!s.user)s.user=r.body.user;save(s);emit('SIGNED_IN',s);return{data:{user:s&&s.user,session:s},error:null}}
return{data:{user:null,session:null},error:errOf(r)}
})
},
signUp:function(c){
var o=c.options||{};
var q=o.emailRedirectTo?'?redirect_to='+encodeURIComponent(o.emailRedirectTo):'';
return xhr('POST',url+'/auth/v1/signup'+q,authHeaders(),JSON.stringify({email:c.email,password:c.password,data:o.data||{}})).then(function(r){
if(r.status>=200&&r.status<300&&r.body){
var b=r.body,s=build(b),u=b.user||(b.id?b:null);
if(s){if(!s.user)s.user=u;save(s);emit('SIGNED_IN',s)}
return{data:{user:u,session:s},error:null}
}
return{data:{user:null,session:null},error:errOf(r)}
})
},
signOut:function(){
return token().then(function(t){
var p=t?xhr('POST',url+'/auth/v1/logout',authHeaders(t),'{}'):Promise.resolve(null);
return p.then(function(){save(null);emit('SIGNED_OUT',null);return{error:null}})
})
},
resetPasswordForEmail:function(email,o){
var q=o&&o.redirectTo?'?redirect_to='+encodeURIComponent(o.redirectTo):'';
return xhr('POST',url+'/auth/v1/recover'+q,authHeaders(),JSON.stringify({email:email})).then(function(r){return out(r,function(){return{}})})
},
updateUser:function(a){
return token().then(function(t){
return xhr('PUT',url+'/auth/v1/user',authHeaders(t),JSON.stringify(a)).then(function(r){
var res=out(r,function(b){return{user:b}});
if(!res.error&&current){current.user=r.body;save(current);emit('USER_UPDATED',current)}
return res
})
})
},
setSession:function(t){
var s=build({access_token:t.access_token,refresh_token:t.refresh_token});
return xhr('GET',url+'/auth/v1/user',authHeaders(t.access_token)).then(function(r){
if(r.status>=200&&r.status<300&&r.body){s.user=r.body;save(s);emit('SIGNED_IN',s);return{data:{session:s,user:s.user},error:null}}
return{data:{session:null,user:null},error:errOf(r)}
})
},
onAuthStateChange:function(cb){
listeners.push(cb);
return{data:{subscription:{unsubscribe:function(){var i=listeners.indexOf(cb);if(i>=0)listeners.splice(i,1)}}}}
}
};
function Q(table){
this.t=table;this.m='GET';this.f=[];this.sel=null;this.body=null;this.prefer=[];this.q={};this.hdr={};this.one=false;this.ord=[];this.lim=null
}
Q.prototype.select=function(c){
if(this.m==='GET'){this.sel=c||'*'}else{this.sel=c||'*';this.prefer.push('return=representation')}
return this
};
Q.prototype.insert=function(b){this.m='POST';this.body=b;return this};
Q.prototype.upsert=function(b,o){
o=o||{};
this.m='POST';this.body=b;
this.prefer.push('resolution='+(o.ignoreDuplicates?'ignore':'merge')+'-duplicates');
if(o.onConflict)this.q.on_conflict=o.onConflict;
return this
};
Q.prototype.update=function(b){this.m='PATCH';this.body=b;return this};
Q.prototype.delete=function(){this.m='DELETE';return this};
function op(name){return function(col,val){this.f.push(col+'='+name+'.'+val);return this}}
Q.prototype.eq=op('eq');Q.prototype.neq=op('neq');Q.prototype.gt=op('gt');Q.prototype.gte=op('gte');Q.prototype.lt=op('lt');Q.prototype.lte=op('lte');Q.prototype.like=op('like');Q.prototype.ilike=op('ilike');
Q.prototype.in=function(col,vals){this.f.push(col+'=in.('+vals.join(',')+')');return this};
Q.prototype.order=function(col,o){this.ord.push(col+'.'+((o&&o.ascending===false)?'desc':'asc'));return this};
Q.prototype.limit=function(n){this.lim=n;return this};
Q.prototype.range=function(a,b){this.hdr['Range-Unit']='items';this.hdr['Range']=a+'-'+b;return this};
Q.prototype.maybeSingle=function(){this.one='maybe';return this};
Q.prototype.single=function(){this.one='one';return this};
Q.prototype.then=function(ok,bad){return this.run().then(ok,bad)};
Q.prototype.run=function(){
var self=this;
return token().then(function(t){
var parts=[];
for(var k in self.q){if(self.q.hasOwnProperty(k))parts.push(k+'='+encodeURIComponent(self.q[k]))}
if(self.sel)parts.push('select='+encodeURIComponent(self.sel));
for(var i=0;i<self.f.length;i++){var j=self.f[i].indexOf('=');parts.push(self.f[i].slice(0,j)+'='+encodeURIComponent(self.f[i].slice(j+1)))}
if(self.ord.length)parts.push('order='+encodeURIComponent(self.ord.join(',')));
if(self.lim!=null)parts.push('limit='+self.lim);
var h=authHeaders(t);
if(self.prefer.length)h['Prefer']=self.prefer.join(',');
for(var hk in self.hdr){if(self.hdr.hasOwnProperty(hk))h[hk]=self.hdr[hk]}
var u=url+'/rest/v1/'+self.t+(parts.length?'?'+parts.join('&'):'');
return xhr(self.m,u,h,self.body==null?null:JSON.stringify(self.body)).then(function(r){
if(r.status>=200&&r.status<300){
var d=r.body;
if(self.one){
var a=Array.isArray(d)?d:(d==null?[]:[d]);
if(self.one==='one'&&a.length!==1)return{data:null,error:{message:'JSON object requested, multiple (or no) rows returned',code:'PGRST116'},status:406};
return{data:a.length?a[0]:null,error:null,status:r.status}
}
return{data:d,error:null,status:r.status}
}
return{data:null,error:errOf(r),status:r.status}
})
})
};
var client={
auth:auth,
from:function(t){return new Q(t)},
channel:function(){var c={on:function(){return c},subscribe:function(cb){if(cb){try{cb('CLOSED')}catch(e){}}return c},unsubscribe:function(){return Promise.resolve('ok')}};return c},
removeChannel:function(){return Promise.resolve('ok')},
removeAllChannels:function(){return Promise.resolve([])}
};
detect();
return client
}
W.rotaLegacyMode=legacyOn;
W.rotaCreateClient=createClient
})();
