const { env, adminClient, requireAdmin, json, parseBody } = require('./_shared');
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed.'});
  try {
    await requireAdmin(event); const {order_id}=parseBody(event); if(!order_id)return json(400,{error:'Order ID is required.'});
    const supabase=adminClient(); const {data:order,error}=await supabase.from('orders').select('id,order_number,total_kobo,payment_status,paystack_reference').eq('id',String(order_id)).maybeSingle(); if(error)throw error;if(!order)return json(404,{error:'Order not found.'});
    if(!order.paystack_reference)return json(409,{error:'This order has no Paystack reference, so its payment cannot be verified through Paystack.'});
    const r=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(order.paystack_reference)}`,{headers:{Authorization:`Bearer ${env('PAYSTACK_SECRET_KEY')}`}});const j=await r.json();const tx=j.data;
    const paid=!!(r.ok&&j.status&&tx?.status==='success'&&Number(tx.amount)===Number(order.total_kobo)&&tx.currency==='NGN'&&tx.reference===order.paystack_reference);
    if(!paid)return json(402,{verified:false,error:`Paystack did not verify this order as paid (provider status: ${tx?.status||j.message||'unknown'}).`});
    const {error:updateError}=await supabase.from('orders').update({payment_status:'paid',updated_at:new Date().toISOString()}).eq('id',order.id);if(updateError)throw updateError;
    return json(200,{verified:true,order_number:order.order_number,amount_naira:Number(order.total_kobo)/100,message:`Paystack verified payment for order ${order.order_number||order.id}: ₦${(Number(order.total_kobo)/100).toLocaleString('en-NG')}.`});
  }catch(e){console.error('admin-verify-order-payment:',e.message);return json(e.statusCode||500,{error:e.statusCode?e.message:'Could not verify payment with Paystack.'});}
};
