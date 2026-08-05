let orders=[];
let pendingId=null;
let editingId=null;
let billingResult=null;

(async()=>{
  const u=await requireUser();
  if(!u)return;
  if(u.email!==ADMIN_EMAIL){location.href='/profilo.html';return}

  el('logoutBtn').onclick=logout;
  el('search').oninput=render;
  el('filter').onchange=render;
  el('deliveredForm').onsubmit=saveDelivered;
  el('editOrderForm').onsubmit=saveOrderChanges;
  el('billingApply').onclick=calculateBilling;
  el('billingClient').onchange=calculateBilling;
  el('billingFrom').onchange=calculateBilling;
  el('billingTo').onchange=calculateBilling;
  el('downloadExcel').onclick=downloadBillingExcel;
  el('printReport').onclick=printBillingReport;
  el('clientAccountSelect').onchange=handleClientSelection;
  el('openClientEdit').onclick=openClientEditor;
  el('loadClientTariff').onclick=loadClientTariff;
  el('saveClientTariff').onclick=saveClientTariff;
  el('editClientForm').onsubmit=saveClientCredentials;
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>el(b.dataset.close).classList.remove('show'));
  setDefaultBillingPeriod();
  await load();
})();

function localISODate(date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function setDefaultBillingPeriod(){
  const now=new Date();
  el('billingFrom').value=localISODate(new Date(now.getFullYear(),now.getMonth(),1));
  el('billingTo').value=localISODate(new Date(now.getFullYear(),now.getMonth()+1,0));
}

async function load(){
  el('orders').innerHTML='<div class="card empty">Caricamento...</div>';
  const{data,error}=await db.from('orders').select('*').order('created_at',{ascending:false});
  if(error){el('orders').innerHTML=`<p class="error">${esc(error.message)}</p>`;return}
  orders=data||[];
  const validOrders=orders.filter(o=>normalizeStatus(o.status)!=='annullato');
  el('total').textContent=validOrders.length;
  el('active').textContent=orders.filter(o=>!['consegnato!','annullato'].includes(normalizeStatus(o.status))).length;
  el('delivered').textContent=orders.filter(o=>normalizeStatus(o.status)==='consegnato!').length;
  el('revenue').textContent=euro(validOrders.reduce((sum,o)=>sum+Number(o.price||0),0));
  populateBillingClients();
  populateClientAccounts();
  calculateBilling();
  render();
}

function populateBillingClients(){
  const select=el('billingClient');
  const current=select.value;
  const clients=[...new Set(orders.map(o=>(o.user_email||'').trim().toLowerCase()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  select.innerHTML='<option value="">Seleziona cliente…</option>'+clients.map(email=>`<option value="${esc(email)}">${esc(email)}</option>`).join('');
  if(clients.includes(current))select.value=current;
}


function populateClientAccounts(){
  const select=el('clientAccountSelect');
  const current=select.value;
  const clients=[...new Set(orders.map(o=>(o.user_email||'').trim().toLowerCase()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  select.innerHTML='<option value="">Seleziona cliente…</option>'+clients.map(email=>`<option value="${esc(email)}">${esc(email)}</option>`).join('');
  if(clients.includes(current))select.value=current;
  el('openClientEdit').disabled=!select.value;
}

async function handleClientSelection(){
  const email=el('clientAccountSelect').value.trim().toLowerCase();
  el('openClientEdit').disabled=!email;el('clientTariffStatus').textContent='';
  if(email){el('clientTariffEmail').value=email;await loadClientTariff()}
}
async function loadClientTariff(){
  const email=el('clientTariffEmail').value.trim().toLowerCase(),status=el('clientTariffStatus');
  if(!email){status.textContent='Inserisci l’email del cliente.';return}
  status.textContent='Verifica tariffa...';
  try{const{data:s}=await db.auth.getSession(),r=await fetch('/api/get-client-tariff?email='+encodeURIComponent(email),{headers:{'Authorization':'Bearer '+s.session?.access_token}}),j=await r.json();if(!r.ok)throw Error(j.error||'Errore tariffa');el('clientTariffSelect').value=j.mode;status.textContent=j.mode==='storico'?'Tariffa attuale: storico (€8,99).':'Tariffa attuale: piena (€11,99).'}catch(err){status.textContent=err.message}
}
async function saveClientTariff(){
  const email=el('clientTariffEmail').value.trim().toLowerCase(),mode=el('clientTariffSelect').value,status=el('clientTariffStatus');if(!email){status.textContent='Inserisci l’email del cliente.';return}status.textContent='Salvataggio...';
  try{const{data:s}=await db.auth.getSession(),r=await fetch('/api/set-client-tariff',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.session?.access_token},body:JSON.stringify({email,mode})}),j=await r.json();if(!r.ok)throw Error(j.error||'Errore salvataggio');status.textContent='Tariffa salvata correttamente.'}catch(err){status.textContent=err.message}
}

function openClientEditor(){
  const email=el('clientAccountSelect').value.trim().toLowerCase();
  if(!email)return;
  el('currentClientNotice').innerHTML=`Account attuale: <strong>${esc(email)}</strong><br><small>Lo stesso User ID e tutti gli ordini verranno mantenuti.</small>`;
  el('newClientEmail').value=email;
  el('newClientPassword').value='';
  el('confirmClientPassword').value='';
  el('forceClientLogout').checked=true;
  el('confirmClientChange').checked=false;
  el('editClientStatus').textContent='';
  el('editClientStatus').className='';
  el('editClientModal').classList.add('show');
}

async function saveClientCredentials(event){
  event.preventDefault();
  const oldEmail=el('clientAccountSelect').value.trim().toLowerCase();
  const newEmail=el('newClientEmail').value.trim().toLowerCase();
  const password=el('newClientPassword').value;
  const confirmPassword=el('confirmClientPassword').value;
  const forceLogout=el('forceClientLogout').checked;
  const status=el('editClientStatus');

  if(!oldEmail){status.textContent='Seleziona prima un cliente.';status.className='error';return}
  if(!newEmail){status.textContent='Inserisci il nuovo indirizzo email.';status.className='error';return}
  if(password!==confirmPassword){status.textContent='Le due password non coincidono.';status.className='error';return}
  if(password&&password.length<8){status.textContent='La password deve contenere almeno 8 caratteri.';status.className='error';return}
  if(forceLogout&&!password){status.textContent='Per disconnettere tutti i dispositivi devi impostare una nuova password.';status.className='error';return}
  if(newEmail===oldEmail&&!password){status.textContent='Modifica l’email oppure inserisci una nuova password.';status.className='error';return}
  if(!el('confirmClientChange').checked){status.textContent='Conferma la modifica delle credenziali.';status.className='error';return}

  const button=el('saveClientBtn');
  button.disabled=true;
  status.textContent='Aggiornamento account e storico ordini...';
  status.className='muted';

  try{
    const {data:sessionData}=await db.auth.getSession();
    const token=sessionData.session?.access_token;
    if(!token)throw new Error('Sessione amministratore scaduta. Esegui nuovamente il login.');
    const response=await fetch('/api/update-client-credentials',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({old_email:oldEmail,new_email:newEmail,new_password:password,force_logout:forceLogout})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'Errore durante la modifica del cliente.');
    status.textContent=`Cliente aggiornato. ${result.orders_updated||0} ordini collegati al nuovo email.${result.password_changed?' Password modificata.':''}${result.sessions_revoked?' Tutte le sessioni del cliente sono state terminate: dovrà accedere nuovamente con le nuove credenziali.':''}`;
    status.className='success';
    el('clientAccountSelect').value='';
    setTimeout(()=>el('editClientModal').classList.remove('show'),1000);
    await load();
    if(newEmail){el('clientAccountSelect').value=newEmail;el('openClientEdit').disabled=false}
  }catch(error){
    status.textContent=error.message||'Errore durante la modifica del cliente.';
    status.className='error';
  }finally{
    button.disabled=false;
  }
}

function dateBounds(fromValue,toValue){
  if(!fromValue||!toValue)return null;
  const from=new Date(`${fromValue}T00:00:00`);
  const to=new Date(`${toValue}T23:59:59.999`);
  if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())||from>to)return null;
  return {from,to};
}

function calculateBilling(){
  const client=el('billingClient').value.trim().toLowerCase();
  const bounds=dateBounds(el('billingFrom').value,el('billingTo').value);
  const enabled=Boolean(client&&bounds);
  el('downloadExcel').disabled=!enabled;
  el('printReport').disabled=!enabled;

  if(!enabled){
    billingResult=null;
    el('billingCount').textContent='—';
    el('billingTotal').textContent='—';
    el('billingCancelled').textContent='—';
    el('billingBreakdown').innerHTML='<p class="muted">Seleziona un cliente e un periodo valido.</p>';
    return;
  }

  const selected=orders.filter(o=>{
    if((o.user_email||'').trim().toLowerCase()!==client)return false;
    const created=new Date(o.created_at);
    return !Number.isNaN(created.getTime())&&created>=bounds.from&&created<=bounds.to;
  });
  const valid=selected.filter(o=>normalizeStatus(o.status)!=='annullato');
  const cancelled=selected.filter(o=>normalizeStatus(o.status)==='annullato');
  const total=valid.reduce((sum,o)=>sum+Number(o.price||0),0);
  const groups=new Map();
  valid.forEach(o=>{
    const price=Number(Number(o.price||0).toFixed(2));
    const key=price.toFixed(2);
    if(!groups.has(key))groups.set(key,{price,count:0,subtotal:0});
    const row=groups.get(key);
    row.count+=1;
    row.subtotal=Number((row.subtotal+price).toFixed(2));
  });
  const breakdown=[...groups.values()].sort((a,b)=>a.price-b.price);
  billingResult={client,bounds,selected,valid,cancelled,total:Number(total.toFixed(2)),breakdown};

  el('billingCount').textContent=valid.length;
  el('billingTotal').textContent=euro(total);
  el('billingCancelled').textContent=cancelled.length;
  el('billingBreakdown').innerHTML=breakdown.length?breakdown.map(row=>`<div class="billingRow"><div><strong>${row.count} ${row.count===1?'ordine':'ordini'}</strong><span>× ${esc(euro(row.price))}</span></div><strong>${esc(euro(row.subtotal))}</strong></div>`).join(''):'<p class="muted">Nessun ordine contabilizzabile nel periodo selezionato.</p>';
}

function excelDate(value){
  if(!value)return '';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'':d.toLocaleString('it-IT');
}

function safeFilePart(value){return String(value||'cliente').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,80)||'cliente'}

function downloadBillingExcel(){
  calculateBilling();
  if(!billingResult)return;
  if(!window.XLSX){alert('Modulo Excel non disponibile. Ricarica la pagina e riprova.');return}
  const r=billingResult;
  const period=`${el('billingFrom').value} - ${el('billingTo').value}`;
  const generated=new Date().toLocaleString('it-IT');

  const summaryRows=[
    ['CONSEGNA24 - RIEPILOGO ECONOMICO CLIENTE'],
    [],
    ['Cliente',r.client],
    ['Periodo',period],
    ['Generato il',generated],
    [],
    ['Ordini contabilizzati',r.valid.length],
    ['Ordini annullati esclusi',r.cancelled.length],
    ['Totale dovuto',r.total],
    [],
    ['RIEPILOGO PER PREZZO'],
    ['Quantità','Prezzo unitario (€)','Subtotale (€)'],
    ...r.breakdown.map(x=>[x.count,x.price,x.subtotal])
  ];
  const detailRows=[['ID ordine','Riferimento cliente','Data ordine','Partenza','Destinazione','Mittente','Telefono mittente','Destinatario','Telefono destinatario','Data / fascia consegna','Prezzo (€)','Pagamento','Stato','Consegnato a','Consegnato il']];
  r.valid.forEach(o=>detailRows.push([
    o.id,o.customer_reference||'',excelDate(o.created_at),o.pickup_address||'',o.delivery_address||'',o.sender_name||'',o.sender_phone||'',o.receiver_name||'',o.receiver_phone||'',formatDeliverySlot(o.delivery_slot),Number(o.price||0),paymentText(o.payment_status),statusInfo(o.status).text,o.delivered_to||'',excelDate(o.delivered_at)
  ]));
  const cancelledRows=[['ID ordine','Riferimento cliente','Data ordine','Partenza','Destinazione','Prezzo (€)','Stato']];
  r.cancelled.forEach(o=>cancelledRows.push([o.id,o.customer_reference||'',excelDate(o.created_at),o.pickup_address||'',o.delivery_address||'',Number(o.price||0),'Annullato']));

  const wb=XLSX.utils.book_new();
  const wsSummary=XLSX.utils.aoa_to_sheet(summaryRows);
  const wsDetail=XLSX.utils.aoa_to_sheet(detailRows);
  const wsCancelled=XLSX.utils.aoa_to_sheet(cancelledRows);
  wsSummary['!cols']=[{wch:31},{wch:32},{wch:20}];
  wsDetail['!cols']=[{wch:12},{wch:20},{wch:34},{wch:34},{wch:22},{wch:18},{wch:22},{wch:18},{wch:28},{wch:13},{wch:20},{wch:30},{wch:28},{wch:20}];
  wsCancelled['!cols']=[{wch:12},{wch:20},{wch:34},{wch:34},{wch:13},{wch:14}];
  if(wsSummary['B9'])wsSummary['B9'].z='#,##0.00 [$€-it-IT]';
  r.breakdown.forEach((_,i)=>{
    const row=13+i;
    if(wsSummary[`B${row}`])wsSummary[`B${row}`].z='#,##0.00 [$€-it-IT]';
    if(wsSummary[`C${row}`])wsSummary[`C${row}`].z='#,##0.00 [$€-it-IT]';
  });
  for(let i=2;i<=detailRows.length;i++)if(wsDetail[`K${i}`])wsDetail[`K${i}`].z='#,##0.00 [$€-it-IT]';
  for(let i=2;i<=cancelledRows.length;i++)if(wsCancelled[`F${i}`])wsCancelled[`F${i}`].z='#,##0.00 [$€-it-IT]';
  XLSX.utils.book_append_sheet(wb,wsSummary,'Riepilogo');
  XLSX.utils.book_append_sheet(wb,wsDetail,'Dettaglio ordini');
  XLSX.utils.book_append_sheet(wb,wsCancelled,'Ordini annullati');
  XLSX.writeFile(wb,`Consegna24_${safeFilePart(r.client)}_${el('billingFrom').value}_${el('billingTo').value}.xlsx`);
}

function printBillingReport(){
  calculateBilling();
  if(!billingResult)return;
  const r=billingResult;
  const period=`${new Date(r.bounds.from).toLocaleDateString('it-IT')} – ${new Date(r.bounds.to).toLocaleDateString('it-IT')}`;
  const breakdown=r.breakdown.length?r.breakdown.map(x=>`<tr><td>${x.count}</td><td>${euro(x.price)}</td><td>${euro(x.subtotal)}</td></tr>`).join(''):'<tr><td colspan="3">Nessun ordine contabilizzabile</td></tr>';
  const details=r.valid.map(o=>`<tr><td>#${esc(o.id)}</td><td>${esc(new Date(o.created_at).toLocaleDateString('it-IT'))}</td><td>${esc(o.pickup_address||'-')} → ${esc(o.delivery_address||'-')}</td><td>${esc(euro(o.price))}</td></tr>`).join('');
  const popup=window.open('','_blank','noopener,noreferrer,width=1000,height=800');
  if(!popup){alert('Il browser ha bloccato la finestra di stampa. Consenti i popup e riprova.');return}
  popup.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Riepilogo ${esc(r.client)}</title><style>body{font-family:Arial,sans-serif;color:#111827;margin:36px}h1{margin:0;font-size:28px}.brand{font-weight:900;color:#f0b400}.meta{margin:18px 0 28px;line-height:1.7}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.kpi{border:1px solid #ddd;border-radius:12px;padding:15px}.kpi span{font-size:12px;color:#666}.kpi strong{display:block;font-size:24px;margin-top:6px}table{width:100%;border-collapse:collapse;margin:14px 0 28px}th,td{border-bottom:1px solid #ddd;padding:10px;text-align:left;font-size:13px}th{background:#f7f8fb}.note{font-size:11px;color:#666;margin-top:30px}@media print{button{display:none}body{margin:15mm}}</style></head><body><div class="brand">Consegna24</div><h1>Riepilogo economico cliente</h1><div class="meta"><b>Cliente:</b> ${esc(r.client)}<br><b>Periodo:</b> ${esc(period)}<br><b>Generato il:</b> ${esc(new Date().toLocaleString('it-IT'))}</div><div class="kpis"><div class="kpi"><span>Ordini contabilizzati</span><strong>${r.valid.length}</strong></div><div class="kpi"><span>Totale dovuto</span><strong>${esc(euro(r.total))}</strong></div><div class="kpi"><span>Annullati esclusi</span><strong>${r.cancelled.length}</strong></div></div><h2>Riepilogo per prezzo</h2><table><thead><tr><th>Quantità</th><th>Prezzo unitario</th><th>Subtotale</th></tr></thead><tbody>${breakdown}</tbody></table><h2>Dettaglio ordini</h2><table><thead><tr><th>ID</th><th>Data</th><th>Tratta</th><th>Prezzo</th></tr></thead><tbody>${details||'<tr><td colspan="4">Nessun ordine</td></tr>'}</tbody></table><p class="note">Documento gestionale di riepilogo. Non sostituisce la fattura fiscale.</p><script>window.onload=()=>window.print()<\/script></body></html>`);
  popup.document.close();
}

function render(){
  const q=el('search').value.toLowerCase();
  const f=el('filter').value;
  const rows=orders.filter(o=>{
    const n=normalizeStatus(o.status);
    return(!f||n===f)&&(!q||JSON.stringify(o).toLowerCase().includes(q));
  });

  el('orders').innerHTML=rows.length?rows.map(o=>`<article class="orderCard">
    <div class="orderTop">
      <div>${o.customer_reference?`<div class="customerRef">Numero ordine: ${esc(o.customer_reference)}</div>`:''}<div class="route">${esc(o.pickup_address||'-')} → ${esc(o.delivery_address||'-')}</div><div class="orderMeta">${esc(fmtDate(o.created_at))} · ${esc(o.user_email||'-')} · ${esc(euro(o.price))}</div></div>
      ${statusBadge(o.status)}
    </div>
    <div class="orderActions">
      <a class="btn ghost" href="/ordine.html?id=${encodeURIComponent(o.id)}">Dettagli</a>
      <button class="btn yellow" type="button" data-edit="${esc(o.id)}">Modifica</button>
      <select class="btn ghost" data-status="${esc(o.id)}">
        <option value="Il corriere non è ancora partito" ${normalizeStatus(o.status)==='Il corriere non è ancora partito'?'selected':''}>Il corriere non è ancora partito</option>
        <option value="Il corriere ha visto l'ordine e sta arrivando" ${normalizeStatus(o.status).includes('ha visto')?'selected':''}>Il corriere ha visto l'ordine e sta arrivando</option>
        <option value="in consegna" ${normalizeStatus(o.status)==='in consegna'?'selected':''}>In consegna</option>
        <option value="consegnato!" ${normalizeStatus(o.status)==='consegnato!'?'selected':''}>Consegnato</option>
        <option value="annullato" ${normalizeStatus(o.status)==='annullato'?'selected':''}>Annullato</option>
      </select>
    </div>
  </article>`).join(''):'<div class="card empty">Nessun ordine trovato.</div>';

  document.querySelectorAll('[data-status]').forEach(s=>s.onchange=()=>changeStatus(s));
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditOrder(b.dataset.edit));
}

function openEditOrder(id){
  const order=orders.find(o=>String(o.id)===String(id));
  if(!order)return;
  editingId=id;
  el('editOrderId').textContent=`Ordine #${order.id}`;
  el('editCustomerReference').value=order.customer_reference||'';
  el('editPickup').value=order.pickup_address||'';
  el('editDelivery').value=order.delivery_address||'';
  el('editSenderName').value=order.sender_name||'';
  el('editSenderPhone').value=order.sender_phone||'';
  el('editReceiverName').value=order.receiver_name||'';
  el('editReceiverPhone').value=order.receiver_phone||'';
  el('editSlot').value=order.delivery_slot||'';
  el('editPrice').value=Number(order.price||0).toFixed(2);
  el('editPayment').value=order.payment_status||'pending';
  el('editPackage').value=order.package_description||'';
  el('editOrderStatus').textContent='';
  el('editOrderStatus').className='';
  el('editOrderModal').classList.add('show');
}

async function saveOrderChanges(e){
  e.preventDefault();
  if(!editingId)return;
  const price=Number(String(el('editPrice').value).replace(',','.'));
  if(!Number.isFinite(price)||price<0){el('editOrderStatus').textContent='Inserisci un prezzo valido.';el('editOrderStatus').className='error';return}
  const payload={customer_reference:el('editCustomerReference').value.trim()||null,pickup_address:el('editPickup').value.trim(),delivery_address:el('editDelivery').value.trim(),sender_name:el('editSenderName').value.trim(),sender_phone:el('editSenderPhone').value.trim(),receiver_name:el('editReceiverName').value.trim(),receiver_phone:el('editReceiverPhone').value.trim(),delivery_slot:el('editSlot').value.trim(),price:Number(price.toFixed(2)),payment_status:el('editPayment').value,package_description:el('editPackage').value.trim()};
  if(!payload.pickup_address||!payload.delivery_address){el('editOrderStatus').textContent='Gli indirizzi di partenza e destinazione sono obbligatori.';el('editOrderStatus').className='error';return}
  const saveBtn=el('saveOrderBtn');saveBtn.disabled=true;el('editOrderStatus').textContent='Salvataggio...';el('editOrderStatus').className='muted';
  const{error}=await db.from('orders').update(payload).eq('id',editingId);saveBtn.disabled=false;
  if(error){el('editOrderStatus').textContent=error.message||'Errore durante il salvataggio.';el('editOrderStatus').className='error';return}
  el('editOrderStatus').textContent='Modifiche salvate.';el('editOrderStatus').className='success';setTimeout(()=>el('editOrderModal').classList.remove('show'),350);editingId=null;await load();
}

async function changeStatus(sel){
  const id=sel.dataset.status,old=orders.find(o=>String(o.id)===String(id))?.status;
  if(sel.value==='consegnato!'){pendingId=id;el('deliveredToInput').value='';el('deliveredModal').classList.add('show');return}
  try{const{data:s}=await db.auth.getSession(),r=await fetch('/api/update-order-status',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.session?.access_token},body:JSON.stringify({order_id:id,status:sel.value})}),j=await r.json();if(!r.ok)throw Error(j.error||'Errore cambio stato');await load()}catch(err){alert(err.message);sel.value=old}
}

async function saveDelivered(e){
  e.preventDefault();const note=el('deliveredToInput').value.trim();if(!note)return;
  try{const{data:s}=await db.auth.getSession(),r=await fetch('/api/update-order-status',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.session?.access_token},body:JSON.stringify({order_id:pendingId,status:'consegnato!',delivered_to:note})}),j=await r.json();if(!r.ok)throw Error(j.error||'Errore consegna');el('deliveredModal').classList.remove('show');pendingId=null;await load()}catch(err){el('deliveredStatus').textContent=err.message}
}
