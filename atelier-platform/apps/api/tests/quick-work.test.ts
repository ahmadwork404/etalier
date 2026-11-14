import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quickTotals,quickWorkSchema} from '../src/services/quick-work.js';
test('Quick Work discounts service prices before tax and keeps tips separate',()=>{
 assert.deepEqual(quickTotals(10000,8000,1000,1000),{subtotal_minor:10000,discount_minor:2000,tax_minor:800,tip_minor:1000,total_minor:9800});
 assert.deepEqual(quickTotals(5000,0,1000,500),{subtotal_minor:5000,discount_minor:5000,tax_minor:0,tip_minor:500,total_minor:500});
 assert.throws(()=>quickTotals(1000,1001,0,0),/tip/);
 assert.equal(quickTotals(999,999,725,0).tax_minor,72);
});
test('Quick Work validates identities, price inputs and distinct service selections',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 const base={request_key:id,customer_type:'walkin',branch_id:id,employee_id:id,service_ids:[id],service_paid_minor:1000,payment_method:'cash'};
 assert.equal(quickWorkSchema.safeParse(base).success,true);
 assert.equal(quickWorkSchema.safeParse({...base,customer_type:'returning'}).success,false);
 assert.equal(quickWorkSchema.safeParse({...base,service_ids:[id,id]}).success,false);
 assert.equal(quickWorkSchema.safeParse({...base,service_ids:[]}).success,false);
 assert.equal(quickWorkSchema.safeParse({...base,service_ids:[],other:{name:'Other'}}).success,false);
 assert.equal(quickWorkSchema.safeParse({...base,service_paid_minor:-1}).success,false);
 assert.equal(quickWorkSchema.safeParse({...base,price_minor:1}).success,false);
 assert.equal(quickWorkSchema.parse({...base,customer_name:' <b>Sam</b> '}).customer_name,'Sam');
});
