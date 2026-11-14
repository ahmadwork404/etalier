import { getDb } from '../../../db';
import { records } from '../../../db/schema';
import { eq } from 'drizzle-orm';
export async function GET(){try{return Response.json(await getDb().select().from(records))}catch{return Response.json({error:'Could not load salon records'},{status:500})}}
export async function POST(request:Request){try{
 const body=await request.json() as {kind:string;id?:string;data:Record<string,any>};
 if(!['appointment','client','service','staff','product','settings'].includes(body.kind)||typeof body.data!=='object'||!body.data)return Response.json({error:'Invalid record'},{status:400});
 const all=(await getDb().select().from(records)).map(r=>({...r,data:JSON.parse(r.data)}));
 const old=all.find(r=>r.id===body.id);if(old&&old.kind!==body.kind)return Response.json({error:'Invalid record type'},{status:400});
 const d=body.data;
 if(body.kind==='appointment'){
 const service=all.find(r=>r.id===d.service&&r.kind==='service');
 if(!service||!all.some(r=>r.id===d.client&&r.kind==='client')||!all.some(r=>r.id===d.staff&&r.kind==='staff')||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!/^\d{2}:\d{2}$/.test(d.time)||!['Pending','Confirmed','In progress','Completed','Cancelled','No show'].includes(d.status))return Response.json({error:'Please choose valid appointment details'},{status:400});
 if(old?.data.paid){d.service=old.data.service;d.amount=old.data.amount;d.paid=true;d.method=old.data.method;}else d.amount=Number(service.data.price);
 const minutes=(t:string)=>Number(t.split(':')[0])*60+Number(t.split(':')[1]);
 if(!['Cancelled','No show'].includes(d.status)&&all.some(r=>r.kind==='appointment'&&r.id!==body.id&&r.data.staff===d.staff&&r.data.date===d.date&&!['Cancelled','No show'].includes(r.data.status)&&minutes(d.time)<minutes(r.data.time)+Number(all.find(s=>s.id===r.data.service)?.data.duration||0)&&minutes(d.time)+Number(service.data.duration)>minutes(r.data.time)))return Response.json({error:'This team member is already booked at that time'},{status:409});
 }else{
 if(typeof d.name!=='string'||!d.name.trim())return Response.json({error:'A name is required'},{status:400});
 for(const key of ['price','stock','minimum','commission','duration'])if(key in d&&(!Number.isFinite(Number(d[key]))||Number(d[key])<0))return Response.json({error:'Invalid numeric value'},{status:400});
 }
 const row={id:body.id||crypto.randomUUID(),kind:body.kind,data:JSON.stringify(d)};
 await getDb().insert(records).values(row).onConflictDoUpdate({target:records.id,set:{data:row.data}});return Response.json(row);
}catch{return Response.json({error:'Could not save changes. Please retry.'},{status:500})}}
export async function DELETE(request:Request){try{const {id}=await request.json() as {id:string};if(typeof id!=='string')return Response.json({error:'Invalid id'},{status:400});const all=await getDb().select().from(records);if(all.some(r=>r.kind==='appointment'&&Object.values(JSON.parse(r.data)).includes(id)))return Response.json({error:'This record is used by an appointment. Keep it to preserve the appointment history.'},{status:409});await getDb().delete(records).where(eq(records.id,id));return Response.json({ok:true})}catch{return Response.json({error:'Could not delete record'},{status:500})}}
