(async()=>{
  const u=await requireUser();
  if(!u)return;

  el('userEmail').textContent=u.email;
  el('adminLink').style.display=u.email===ADMIN_EMAIL?'':'none';
  el('logoutBtn').onclick=logout;

  const dateFrom=el('dateFrom');
  const dateTo=el('dateTo');
  const applyBtn=el('applyFilterBtn');
  const currentMonthBtn=el('currentMonthBtn');
  let allOrders=[];

  function dateInputValue(date){
    const y=date.getFullYear();
    const m=String(date.getMonth()+1).padStart(2,'0');
    const d=String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  function setCurrentMonth(){
    const now=new Date();
    dateFrom.value=dateInputValue(new Date(now.getFullYear(),now.getMonth(),1));
    dateTo.value=dateInputValue(new Date(now.getFullYear(),now.getMonth()+1,0));
  }

  function parseLocalDate(value,endOfDay=false){
    const [y,m,d]=String(value||'').split('-').map(Number);
    if(!y||!m||!d)return null;
    return endOfDay
      ? new Date(y,m-1,d,23,59,59,999)
      : new Date(y,m-1,d,0,0,0,0);
  }

  function formatOnlyDate(date){
    return date.toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
  }

  // La data gestionale dell'ordine è il giorno in cui la consegna deve essere eseguita.
  // Per gli ordini storici senza una fascia valida manteniamo created_at come fallback.
  function deliveryDateISO(order){
    const match=String(order?.delivery_slot||'').match(/^(\d{4}-\d{2}-\d{2})/);
    if(match)return match[1];
    if(order?.created_at){
      const d=new Date(order.created_at);
      if(!Number.isNaN(d.getTime()))return dateInputValue(d);
    }
    return '';
  }

  function deliveryDate(order){
    const iso=deliveryDateISO(order);
    return iso?parseLocalDate(iso):null;
  }

  function deliverySlotTime(order){
    const raw=String(order?.delivery_slot||'');
    const parts=raw.split('|');
    return parts.length>1?parts.slice(1).join('|').trim():'';
  }

  function render(){
    const from=parseLocalDate(dateFrom.value);
    const to=parseLocalDate(dateTo.value,true);

    if(!from||!to){
      el('periodSummary').textContent='Seleziona entrambe le date.';
      el('periodSummary').className='periodSummary error';
      return;
    }
    if(from>to){
      el('periodSummary').textContent='La data iniziale non può essere successiva alla data finale.';
      el('periodSummary').className='periodSummary error';
      return;
    }

    const filtered=allOrders.filter(o=>{
      const planned=deliveryDate(o);
      return planned&&planned>=from&&planned<=to;
    }).sort((a,b)=>{
      const da=deliveryDate(a)?.getTime()||0,db=deliveryDate(b)?.getTime()||0;
      return db-da;
    });

    const valid=filtered.filter(o=>normalizeStatus(o.status)!=='annullato');
    const paid=valid.filter(o=>o.payment_status==='paid'||o.payment_status==='cash_on_delivery');
    const total=valid.reduce((sum,o)=>sum+Number(o.price||0),0);
    const rangeText=`Dal ${formatOnlyDate(from)} al ${formatOnlyDate(to)}`;

    el('countAll').textContent=valid.length;
    el('countPaid').textContent=paid.length;
    el('spent').textContent=euro(total);
    el('periodSummary').textContent=rangeText;
    el('periodSummary').className='periodSummary';
    el('ordersRangeLabel').textContent=rangeText;
    el('resultsCount').textContent=`${filtered.length} ${filtered.length===1?'consegna':'consegne'}`;

    el('orders').innerHTML=filtered.length
      ? filtered.map(o=>{
          const status=statusInfo(o.status);
          const deliveredTime=status.level===3&&o.delivered_at
            ? `<span class="deliveredTime">alle ${esc(new Date(o.delivered_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}))}</span>`
            : '';
          return `<article class="orderCard"><div class="orderTop"><div>${o.customer_reference?`<div class="customerRef">Numero ordine: ${esc(o.customer_reference)}</div>`:''}<div class="route">${esc(o.pickup_address||'-')} → ${esc(o.delivery_address||'-')}</div><div class="orderMeta"><strong>Consegna: ${esc(formatOnlyDate(deliveryDate(o)))}</strong>${deliverySlotTime(o)?` · ${esc(deliverySlotTime(o))}`:''} · ${esc(euro(o.price))} · ${esc(paymentText(o.payment_status))}</div></div><div class="statusStack">${statusBadge(o.status)}${deliveredTime}</div></div><div class="orderActions"><a class="btn primary" href="/ordine.html?id=${encodeURIComponent(o.id)}">Apri dettagli</a></div></article>`;
        }).join('')
      : '<div class="card empty">Nessuna consegna nel periodo selezionato.</div>';
  }

  setCurrentMonth();
  applyBtn.onclick=render;
  currentMonthBtn.onclick=()=>{setCurrentMonth();render()};
  dateFrom.addEventListener('change',render);
  dateTo.addEventListener('change',render);

  const{data,error}=await db.from('orders').select('*').eq('user_email',u.email).order('created_at',{ascending:false});
  if(error){
    el('orders').innerHTML=`<p class="error">${esc(error.message)}</p>`;
    return;
  }
  allOrders=Array.isArray(data)?data:[];
  render();
})();
