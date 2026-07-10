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
async function logout(){await db.auth.signOut();location.href='/'}
