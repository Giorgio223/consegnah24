let authMode='login',quote=null,selected={from:null,to:null},map,currentLegacyTariff=false;
const $=Object.fromEntries(['loginBtn','registerBtn','profileLink','adminLink','authModal','authTitle','authForm','authSubmit','authStatus','nameWrap','nameInput','emailInput','passwordInput','quoteForm','fromInput','toInput','quoteStatus','priceModal','sumFrom','sumTo','sumPrice','sumKm','orderForm','senderName','senderPhone','receiverName','receiverPhone','packageText','deliveryDate','deliverySlot','orderStatus','cashBtn','heroPriceText'].map(id=>[id,el(id)]));
function initMap(){map=L.map('map',{zoomControl:true}).setView([45.4642,9.19],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map)}
function draw(a,b){if(map._route)map.removeLayer(map._route);(map._markers||[]).forEach(m=>map.removeLayer(m));map._markers=[L.marker(a).addTo(map),L.marker(b).addTo(map)];map._route=L.polyline([a,b],{color:'#f7bd00',weight:7,opacity:.95}).addTo(map);map.fitBounds(map._route.getBounds(),{padding:[50,50]})}
function title(s){return(s||'').toLowerCase().replace(/\b\p{L}/gu,m=>m.toUpperCase())}
function component(place,type){return(place.address_components||[]).find(c=>c.types.includes(type))?.long_name||''}
function normalizePlace(place,fallback){if(!place?.geometry?.location)return null;const route=component(place,'route')||place.name||fallback,number=component(place,'street_number'),cap=component(place,'postal_code'),city=component(place,'locality')||component(place,'postal_town')||component(place,'administrative_area_level_3')||component(place,'administrative_area_level_2');return{label:[title(route)+(number?' '+number:''),cap,city].filter(Boolean).join(', ')||place.formatted_address||fallback,lat:place.geometry.location.lat(),lon:place.geometry.location.lng()}}
function initGooglePlaces(){if(!window.google?.maps?.places)return;const opts={componentRestrictions:{country:'it'},fields:['address_components','geometry','formatted_address','name'],types:['geocode']};[['from',$.fromInput],['to',$.toInput]].forEach(([f,input])=>{const ac=new google.maps.places.Autocomplete(input,opts);ac.addListener('place_changed',()=>{const p=normalizePlace(ac.getPlace(),input.value);if(p){selected[f]=p;input.value=p.label}});input.addEventListener('input',()=>selected[f]=null)});window.googleGeocoder=new google.maps.Geocoder();$.quoteStatus.textContent='Ricerca indirizzi Google attiva.'}
window.initGooglePlaces=initGooglePlaces;
async function resolveAddress(field,input){if(selected[field])return selected[field];const q=input.value.trim();if(q.length<4)throw Error('Inserisci via, civico e città.');return new Promise((resolve,reject)=>googleGeocoder.geocode({address:q,componentRestrictions:{country:'IT'}},(r,s)=>{if(s==='OK'&&r?.[0]){const p=normalizePlace(r[0],q);selected[field]=p;input.value=p.label;resolve(p)}else reject(Error('Indirizzo non trovato.'))}))}
function km(a,b){const R=6371,dLat=(b[0]-a[0])*Math.PI/180,dLon=(b[1]-a[1])*Math.PI/180,la1=a[0]*Math.PI/180,la2=b[0]*Math.PI/180,h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))}
function localDateValue(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`}
function buildSlots(){
  if(!$.deliveryDate||!$.deliverySlot)return;
  const today=localDateValue();
  if(!$.deliveryDate.value)$.deliveryDate.value=today;
  $.deliveryDate.min=today;
  const isToday=$.deliveryDate.value===today;
  const now=new Date();
  const firstHour=isToday?Math.min(22,Math.floor(now.getHours()/2)*2):0;
  const hours=[];
  for(let h=firstHour;h<24;h+=2)hours.push(h);
  if(!hours.length)hours.push(22);
  $.deliverySlot.innerHTML=hours.map(h=>{const end=(h+2)%24;const value=`${String(h).padStart(2,'0')}:00 - ${String(end).padStart(2,'0')}:00`;return `<option value="${value}">${value}</option>`}).join('');
}
function openAuth(mode){authMode=mode;$.authTitle.textContent=mode==='register'?'Registrazione':'Login';$.authSubmit.textContent=mode==='register'?'Crea account':'Accedi';$.nameWrap.style.display=mode==='register'?'block':'none';$.authStatus.textContent='';$.authModal.classList.add('show')}
async function refreshNav(){
  const u=await getUser();
  currentLegacyTariff=isLegacyUser(u);
  $.loginBtn.style.display=u?'none':'';
  $.registerBtn.style.display=u?'none':'';
  $.profileLink.style.display=u?'':'none';
  $.adminLink.style.display=u?.email===ADMIN_EMAIL?'':'none';
  if($.heroPriceText)$.heroPriceText.textContent=currentLegacyTariff?'Da € 8,99':'Da € 11,99';
  if(quote){
    quote.price=calculateDeliveryPrice(quote.km,currentLegacyTariff);
    $.sumPrice.textContent=euro(quote.price);
  }
}
$.loginBtn.onclick=()=>openAuth('login');$.registerBtn.onclick=()=>openAuth('register');document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>el(b.dataset.close).classList.remove('show'));
$.authForm.onsubmit=async e=>{e.preventDefault();$.authSubmit.disabled=true;$.authStatus.textContent='Attendi...';try{const email=$.emailInput.value.trim().toLowerCase(),password=$.passwordInput.value;const r=authMode==='register'?await db.auth.signUp({email,password,options:{data:{name:$.nameInput.value.trim()}}}):await db.auth.signInWithPassword({email,password});if(r.error)throw r.error;$.authStatus.className='success';$.authStatus.textContent='Accesso effettuato.';setTimeout(()=>{$.authModal.classList.remove('show');refreshNav()},400)}catch(err){$.authStatus.className='error';$.authStatus.textContent=err.message}finally{$.authSubmit.disabled=false}};
$.quoteForm.onsubmit=async e=>{
  e.preventDefault();
  $.quoteStatus.textContent='Calcolo...';
  try{
    const u=await getUser();
    currentLegacyTariff=isLegacyUser(u);
    const f=await resolveAddress('from',$.fromInput),t=await resolveAddress('to',$.toInput),a=[f.lat,f.lon],b=[t.lat,t.lon],d=km(a,b),p=calculateDeliveryPrice(d,currentLegacyTariff);
    quote={from:f.label,to:t.label,km:d,price:p};
    draw(a,b);
    $.sumFrom.textContent=quote.from;
    $.sumTo.textContent=quote.to;
    $.sumPrice.textContent=euro(p);
    $.sumKm.textContent=d.toFixed(1).replace('.',',')+' km stimati';
    buildSlots();
    $.priceModal.classList.add('show');
    $.quoteStatus.textContent='Prezzo calcolato.';
  }catch(err){$.quoteStatus.textContent=err.message}
};
async function createOrder(method){
  const u=await getUser();
  if(!u){$.priceModal.classList.remove('show');openAuth('login');throw Error('Accedi prima di salvare la consegna.')}
  if(!quote)throw Error('Calcola prima il prezzo della consegna.');
  currentLegacyTariff=isLegacyUser(u);
  quote.price=calculateDeliveryPrice(quote.km,currentLegacyTariff);
  $.sumPrice.textContent=euro(quote.price);
  $.sumKm.textContent=quote.km.toFixed(1).replace('.',',')+' km stimati';
  const payload={user_email:u.email,pickup_address:quote.from,delivery_address:quote.to,sender_name:$.senderName.value.trim(),sender_phone:$.senderPhone.value.trim(),receiver_name:$.receiverName.value.trim(),receiver_phone:$.receiverPhone.value.trim(),package_description:$.packageText.value.trim(),delivery_slot:`${$.deliveryDate.value} | ${$.deliverySlot.value}`,price:Number(quote.price.toFixed(2)),status:'Il corriere non è ancora partito',payment_status:method==='cash'?'cash_on_delivery':'pending'};
  const{data,error}=await db.from('orders').insert(payload).select('id').single();
  if(error)throw error;
  const {data:s}=await db.auth.getSession();
  fetch('/api/send-telegram-notification',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.session?.access_token},body:JSON.stringify({order_id:data.id})}).catch(()=>{});
  return data
}
$.orderForm.onsubmit=async e=>{e.preventDefault();try{$.orderStatus.textContent='Apro il pagamento...';const o=await createOrder('card'),{data:s}=await db.auth.getSession(),r=await fetch('/api/create-checkout-session',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.session.access_token},body:JSON.stringify({order_id:o.id})}),j=await r.json();if(!r.ok)throw Error(j.error||'Errore Stripe');location.href=j.url}catch(err){$.orderStatus.className='error';$.orderStatus.textContent=err.message}};
$.cashBtn.onclick=async()=>{try{$.orderStatus.textContent='Salvo...';const o=await createOrder('cash');location.href=`/ordine.html?id=${encodeURIComponent(o.id)}`}catch(err){$.orderStatus.className='error';$.orderStatus.textContent=err.message}};
async function paymentReturn(){const p=new URLSearchParams(location.search),sid=p.get('session_id'),id=p.get('order');if(p.get('payment')==='success'&&sid){await fetch('/api/verify-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sid})}).catch(()=>{});location.replace('/ordine.html?id='+encodeURIComponent(id))}}
if($.deliveryDate)$.deliveryDate.addEventListener('change',buildSlots);
initMap();refreshNav();paymentReturn();if(new URLSearchParams(location.search).get('login'))openAuth('login');db.auth.onAuthStateChange(refreshNav);
