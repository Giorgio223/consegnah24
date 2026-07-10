let orders=[];
let pendingId=null;
let editingId=null;

(async()=>{
  const u=await requireUser();
  if(!u)return;
  if(u.email!==ADMIN_EMAIL){location.href='/profilo.html';return}

  el('logoutBtn').onclick=logout;
  el('search').oninput=render;
  el('filter').onchange=render;
  el('deliveredForm').onsubmit=saveDelivered;
  el('editOrderForm').onsubmit=saveOrderChanges;
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>el(b.dataset.close).classList.remove('show'));
  await load();
})();

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
  render();
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
      <div>
        <div class="route">${esc(o.pickup_address||'-')} → ${esc(o.delivery_address||'-')}</div>
        <div class="orderMeta">${esc(fmtDate(o.created_at))} · ${esc(o.user_email||'-')} · ${esc(euro(o.price))}</div>
      </div>
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
  if(!Number.isFinite(price)||price<0){
    el('editOrderStatus').textContent='Inserisci un prezzo valido.';
    el('editOrderStatus').className='error';
    return;
  }

  const payload={
    pickup_address:el('editPickup').value.trim(),
    delivery_address:el('editDelivery').value.trim(),
    sender_name:el('editSenderName').value.trim(),
    sender_phone:el('editSenderPhone').value.trim(),
    receiver_name:el('editReceiverName').value.trim(),
    receiver_phone:el('editReceiverPhone').value.trim(),
    delivery_slot:el('editSlot').value.trim(),
    price:Number(price.toFixed(2)),
    payment_status:el('editPayment').value,
    package_description:el('editPackage').value.trim()
  };

  if(!payload.pickup_address||!payload.delivery_address){
    el('editOrderStatus').textContent='Gli indirizzi di partenza e destinazione sono obbligatori.';
    el('editOrderStatus').className='error';
    return;
  }

  const saveBtn=el('saveOrderBtn');
  saveBtn.disabled=true;
  el('editOrderStatus').textContent='Salvataggio...';
  el('editOrderStatus').className='muted';

  const{error}=await db.from('orders').update(payload).eq('id',editingId);
  saveBtn.disabled=false;
  if(error){
    el('editOrderStatus').textContent=error.message||'Errore durante il salvataggio.';
    el('editOrderStatus').className='error';
    return;
  }

  el('editOrderStatus').textContent='Modifiche salvate.';
  el('editOrderStatus').className='success';
  setTimeout(()=>el('editOrderModal').classList.remove('show'),350);
  editingId=null;
  await load();
}

async function changeStatus(sel){
  const id=sel.dataset.status;
  const old=orders.find(o=>String(o.id)===String(id))?.status;
  if(sel.value==='consegnato!'){
    pendingId=id;
    el('deliveredToInput').value='';
    el('deliveredModal').classList.add('show');
    return;
  }
  const update={status:sel.value};
  if(sel.value!=='consegnato!'){
    update.delivered_to=null;
    update.delivered_at=null;
  }
  const{error}=await db.from('orders').update(update).eq('id',id);
  if(error){alert(error.message);sel.value=old;return}
  await load();
}

async function saveDelivered(e){
  e.preventDefault();
  const note=el('deliveredToInput').value.trim();
  if(!note)return;
  const{error}=await db.from('orders').update({status:'consegnato!',delivered_to:note,delivered_at:new Date().toISOString()}).eq('id',pendingId);
  if(error){el('deliveredStatus').textContent=error.message;return}
  el('deliveredModal').classList.remove('show');
  pendingId=null;
  await load();
}
