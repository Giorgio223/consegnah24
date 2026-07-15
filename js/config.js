const SUPABASE_URL='https://fsemlifljgxqwrtoydgv.supabase.co';
const SUPABASE_KEY='sb_publishable_-Sbe77aLywMF-YSUKDg69g_f9J6zD23';
const ADMIN_EMAIL='angiorgio6@gmail.com';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
const el=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const euro=v=>'€ '+Number(v||0).toFixed(2).replace('.',',');
async function getUser(){const {data}=await db.auth.getSession();return data.session?.user||null}
async function requireUser(){const u=await getUser();if(!u){location.href='/?login=1';return null}return u}
function paymentText(v){if(v==='paid')return 'Pagato online';if(v==='cash_on_delivery')return 'Pagamento al ritiro';if(v==='checkout_created')return 'Checkout creato';return 'Non pagato'}
function normalizeStatus(s=''){
 const st=s.toLowerCase().trim();
 if(st.includes('annull'))return 'annullato';
 if(st.includes('consegnato'))return 'consegnato!';
 if(st.includes('in consegna'))return 'in consegna';
 if(st.includes('ha visto')||st.includes('sta arrivando'))return "Il corriere ha visto l'ordine e sta arrivando";
 return 'Il corriere non è ancora partito';
}
function statusInfo(s){const n=normalizeStatus(s);if(n==='annullato')return {text:'Annullato',cls:'red',level:-1};if(n==='consegnato!')return {text:'Consegnato',cls:'green',level:3};if(n==='in consegna')return {text:'In consegna',cls:'blue',level:2};if(n.includes('ha visto'))return {text:"Il corriere ha visto l'ordine e sta arrivando",cls:'yellow',level:1};return {text:'Il corriere non è ancora partito',cls:'gray',level:0}}
function statusBadge(s){const x=statusInfo(s);return `<span class="status ${x.cls}"><span class="dot"></span>${esc(x.text)}</span>`}
function fmtDate(v){return v?new Date(v).toLocaleString('it-IT'):'-'}
function formatDeliverySlot(value){
  const raw=String(value||'').trim();
  const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})\s*\|\s*(.+)$/);
  if(!m)return raw||'-';
  const date=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  const label=date.toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
  return `${label} · ${m[4]}`;
}

async function logout(){await db.auth.signOut();location.href='/'}


// Tariffe Consegna24.
// Gli account creati prima di questa data mantengono la tariffa storica.
const NEW_TARIFF_CUTOFF='2026-07-12T14:57:29Z';
const LEGACY_BASE_PRICE=8.99;
const NEW_BASE_PRICE=11.99;
const NEW_INCLUDED_KM=10;
const NEW_EXTRA_KM_PRICE=1;

function isLegacyUser(user){
  if(!user?.created_at)return false;
  const created=Date.parse(user.created_at);
  const cutoff=Date.parse(NEW_TARIFF_CUTOFF);
  return Number.isFinite(created)&&created<cutoff;
}

function calculateDeliveryPrice(distanceKm,legacy=false){
  const distance=Math.max(0,Number(distanceKm)||0);
  if(legacy){
    // Tariffa storica: minimo €8,99, poi €0,90/km.
    return Math.max(LEGACY_BASE_PRICE,distance*0.9);
  }
  // Nuova tariffa: €11,99 fino a 10 km, poi €1 per ogni km eccedente.
  return NEW_BASE_PRICE+Math.max(0,distance-NEW_INCLUDED_KM)*NEW_EXTRA_KM_PRICE;
}

function tariffDescription(legacy=false){
  return legacy
    ? 'Tariffa cliente storico: minimo € 8,99, poi € 0,90/km.'
    : 'Tariffa attuale: € 11,99 fino a 10 km, poi € 1,00 per ogni km aggiuntivo.';
}
