const { env, adminClient, requireUser, requireAdmin, json, parseBody } = require('./_shared');
const ADMIN_EMAIL = 'muhammadhg2048@gmail.com';
async function notify(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { sent: false, reason: 'Email provider is not configured (RESEND_API_KEY and EMAIL_FROM).' };
  const r = await fetch('https://api.resend.com/emails', { method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify({from,to,subject,html}) });
  const j = await r.json().catch(()=>({}));
  if (!r.ok) { console.error('Resend email failed', r.status, j); return {sent:false,reason:'Email provider rejected the message.'}; }
  return {sent:true};
}
const esc = v => String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed.'});
  try {
    const body = parseBody(event), action = String(body.action || '');
    if (action === 'create_initial') {
      const {user} = await requireUser(event), supabase = adminClient();
      const name=String(body.name||'').trim(), email=String(body.email||'').trim(), whatsapp=String(body.whatsapp||'').trim(), features=String(body.features||'').trim();
      if (!name || name.length>160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !whatsapp || whatsapp.length>40 || features.length<10 || features.length>5000) return json(400,{error:'Provide valid name, email, WhatsApp number and website description.'});
      const {data:draft,error}=await supabase.from('service_request_drafts').insert({user_id:user.id,customer_name:name,customer_email:email,whatsapp,requested_features:features,initial_fee_kobo:100000,final_fee_kobo:200000,status:'awaiting_payment'}).select('id').single();
      if(error) throw error;
      const reference=`svcinit_${draft.id}_${Date.now()}`, siteUrl=env('SITE_URL').replace(/\/$/,'');
      const payRes=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${env('PAYSTACK_SECRET_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify({email,amount:100000,currency:'NGN',reference,callback_url:`${siteUrl}/?service_payment_reference=${encodeURIComponent(reference)}&service_payment_stage=initial`,metadata:{purpose:'website_initial_fee',draft_id:draft.id,user_id:user.id,customer_email:email}})});
      const pay=await payRes.json();
      if(!payRes.ok||!pay.status||!pay.data?.authorization_url){await supabase.from('service_request_drafts').update({status:'payment_initialization_failed'}).eq('id',draft.id);return json(502,{error:'Paystack could not start the initial ₦1,000 payment. Please try again.'});}
      await supabase.from('service_request_drafts').update({initial_paystack_reference:pay.data.reference}).eq('id',draft.id);
      return json(200,{authorization_url:pay.data.authorization_url,reference:pay.data.reference});
    }
    if (action === 'verify_initial') {
      const {user}=await requireUser(event), reference=String(body.reference||'');
      if(!reference.startsWith('svcinit_')) return json(400,{error:'Invalid website request payment reference.'});
      const response=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${env('PAYSTACK_SECRET_KEY')}`}}); const result=await response.json(); const tx=result.data;
      if(!response.ok||!result.status||tx?.status!=='success'||Number(tx.amount)!==100000||tx.currency!=='NGN'||tx.reference!==reference||tx.metadata?.purpose!=='website_initial_fee'||tx.metadata?.user_id!==user.id) return json(402,{error:'Paystack has not verified the full ₦1,000 initial website fee.'});
      const supabase=adminClient(); const {data:draft,error}=await supabase.from('service_request_drafts').select('*').eq('id',tx.metadata.draft_id).eq('user_id',user.id).eq('initial_paystack_reference',reference).maybeSingle(); if(error)throw error; if(!draft)return json(404,{error:'Website request draft was not found.'});
      const {data:existing,error:existingError}=await supabase.from('service_requests').select('id').eq('initial_paystack_reference',reference).maybeSingle(); if(existingError)throw existingError;
      let request=existing;
      if(!request){const {data:created,error:createError}=await supabase.from('service_requests').insert({user_id:user.id,customer_name:draft.customer_name,customer_email:draft.customer_email,whatsapp:draft.whatsapp,requested_features:draft.requested_features,initial_fee_kobo:100000,final_fee_kobo:200000,payment_status:'paid',status:'submitted',initial_payment_status:'paid',initial_paystack_reference:reference}).select('id').single();if(createError)throw createError;request=created;}
      await supabase.from('service_request_drafts').update({status:'submitted',service_request_id:request.id}).eq('id',draft.id);
      const adminHtml=`<h2>New paid website development request</h2><p>Paystack verified the initial ₦1,000 payment.</p><p><b>Customer:</b> ${esc(draft.customer_name)}<br><b>Email:</b> ${esc(draft.customer_email)}<br><b>WhatsApp:</b> ${esc(draft.whatsapp)}<br><b>Request ID:</b> ${esc(request.id)}</p><p><b>Requirements:</b><br>${esc(draft.requested_features).replace(/\n/g,'<br>')}</p><p>Open the Gadzama eShop admin dashboard to review this request.</p>`;
      const userHtml=`<h2>Your Gadzama eShop website request was received</h2><p>Hello ${esc(draft.customer_name)}, Paystack verified your initial payment of ₦1,000. Your request has been sent to the store and is available in the admin dashboard. We will contact you at this email or your WhatsApp number (${esc(draft.whatsapp)}) when we have an update.</p>`;
      const [adminMail,userMail]=await Promise.all([notify(ADMIN_EMAIL,'New paid website request — Gadzama eShop',adminHtml),notify(draft.customer_email,'Your website request was received — Gadzama eShop',userHtml)]);
      return json(200,{verified:true,request_id:request.id,message:'Paystack verified the ₦1,000 payment. Your website request is now saved and visible to the store.',email_notifications:{admin:adminMail.sent,customer:userMail.sent,configuration:(!adminMail.sent||!userMail.sent)?'Set RESEND_API_KEY and EMAIL_FROM in Netlify to enable automatic emails.':undefined}});
    }
    if (action === 'notify_seller_decision') {
      const {user}=await requireAdmin(event); const email=String(body.email||'').trim(), name=String(body.name||'Seller').trim(), product=String(body.product||'your product').trim(), decision=String(body.decision||'').trim(), note=String(body.note||'').trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['approved','rejected'].includes(decision))return json(400,{error:'Valid seller email and decision are required.'});
      const subject=decision==='approved'?'Your product was approved — Gadzama eShop':'Update on your product application — Gadzama eShop';
      const html=decision==='approved'?`<h2>Product approved</h2><p>Hello ${esc(name)}, your product <b>${esc(product)}</b> has been approved and published on Gadzama eShop.</p>${note?`<p>Note: ${esc(note)}</p>`:''}<p>Support: ${ADMIN_EMAIL} · WhatsApp +2347038669725</p>`:`<h2>Product application update</h2><p>Hello ${esc(name)}, your application for <b>${esc(product)}</b> was not approved at this time.</p>${note?`<p>Reason or instructions: ${esc(note)}</p>`:''}<p>You may contact support at ${ADMIN_EMAIL} or WhatsApp +2347038669725.</p>`;
      const result=await notify(email,subject,html); return json(200,{sent:result.sent,message:result.sent?'Seller notification sent.':'Seller status was saved, but automatic email is not configured. Set RESEND_API_KEY and EMAIL_FROM in Netlify.'});
    }
    if (action === 'create_final') {
      const {supabase,user}=await requireAdmin(event), id=String(body.request_id||''); if(!id)return json(400,{error:'Request ID is required.'});
      const {data:req,error}=await supabase.from('service_requests').select('*').eq('id',id).single();if(error)throw error;
      const reference=`svcfinal_${req.id}_${Date.now()}`,siteUrl=env('SITE_URL').replace(/\/$/,'');
      const payRes=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${env('PAYSTACK_SECRET_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify({email:req.customer_email,amount:200000,currency:'NGN',reference,callback_url:`${siteUrl}/?service_payment_reference=${encodeURIComponent(reference)}&service_payment_stage=final`,metadata:{purpose:'website_final_fee',request_id:req.id,user_id:req.user_id,initiated_by:user.id}})});const pay=await payRes.json();if(!payRes.ok||!pay.status||!pay.data?.authorization_url)return json(502,{error:'Paystack could not initialize the ₦2,000 final payment.'});
      const {error:updateError}=await supabase.from('service_requests').update({final_paystack_reference:pay.data.reference,final_payment_status:'pending'}).eq('id',id);if(updateError)throw updateError;
      const mail=await notify(req.customer_email,'Final website payment — Gadzama eShop',`<h2>Your website preview is ready</h2><p>Please approve the preview with the store, then complete the final ₦2,000 payment securely here: <a href="${esc(pay.data.authorization_url)}">Pay ₦2,000 with Paystack</a>.</p><p>If you have questions, contact ${ADMIN_EMAIL} or WhatsApp +2347038669725.</p>`);
      return json(200,{message:'Final payment link created.',email_sent:mail.sent});
    }
    if (action === 'verify_final') {
      const {user}=await requireUser(event),reference=String(body.reference||'');if(!reference.startsWith('svcfinal_'))return json(400,{error:'Invalid final payment reference.'});
      const response=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${env('PAYSTACK_SECRET_KEY')}`}});const result=await response.json(),tx=result.data;
      if(!response.ok||!result.status||tx?.status!=='success'||Number(tx.amount)!==200000||tx.currency!=='NGN'||tx.reference!==reference||tx.metadata?.purpose!=='website_final_fee'||tx.metadata?.user_id!==user.id)return json(402,{error:'Paystack has not verified the full ₦2,000 final fee.'});
      const supabase=adminClient();const {data:req,error}=await supabase.from('service_requests').select('*').eq('id',tx.metadata.request_id).eq('user_id',user.id).eq('final_paystack_reference',reference).maybeSingle();if(error)throw error;if(!req)return json(404,{error:'Website request not found for this account.'});
      const {error:updateError}=await supabase.from('service_requests').update({final_payment_status:'paid',payment_status:'paid'}).eq('id',req.id);if(updateError)throw updateError;
      await notify(ADMIN_EMAIL,'Final website payment verified — Gadzama eShop',`<p>Paystack verified the ₦2,000 final payment for request ${esc(req.id)} from ${esc(req.customer_name)}.</p>`);
      return json(200,{verified:true,message:'Paystack verified your ₦2,000 final payment. Thank you.'});
    }
    return json(400,{error:'Unknown payment action.'});
  } catch(e){console.error('service-payment:',e.message);return json(e.statusCode||500,{error:e.statusCode?e.message:'Could not process the website payment. Please try again.'});}
};
