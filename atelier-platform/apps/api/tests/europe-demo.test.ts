import {test} from 'node:test';
import assert from 'node:assert/strict';
import {europeanDemoPlan,demoPhotos} from '../scripts/europe-demo-plan.js';
test('European demo uses EUR minor units and a connected set of real application records',()=>{
  const plan=europeanDemoPlan(new Date('2026-11-13T14:00:00Z'));
  assert.equal(plan.salon.currency,'EUR');assert.equal(plan.salon.timezone,'Europe/Paris');
  assert.equal(plan.locations.length,2);assert.equal(plan.employees.length,4);
  assert.ok(plan.appointments.some(a=>a.date===plan.today));assert.ok(plan.appointments.some(a=>a.date>plan.today&&a.advance));assert.ok(plan.quickVisits.some(a=>a.date===plan.today&&a.walkin));
  for(const service of plan.services){assert.ok(Number.isInteger(service.price));assert.ok(service.price>0&&service.price<20000);}
  for(const item of [...plan.appointments,...plan.quickVisits]){assert.ok(plan.employees[item.employee]);assert.ok(plan.customers[item.customer]);assert.ok(plan.services[item.service]);}
  const photos=new Set(demoPhotos.map(photo=>photo.key));for(const item of [...plan.locations,...plan.employees,...plan.customers,...plan.services])if(item.photo)assert.ok(photos.has(item.photo));
});
test('European demo appointments fit working hours, avoid leave and never overlap per employee',()=>{
  const plan=europeanDemoPlan(new Date('2026-11-13T14:00:00Z'));
  for(const item of plan.appointments){
    const end=item.hour+plan.services[item.service].minutes/60;assert.ok(item.hour>=9&&end<=19);
    assert.ok(!plan.leaves.some(leave=>leave.employee===item.employee&&leave.date===item.date&&item.hour<Number(leave.until.slice(0,2))&&end>Number(leave.from.slice(0,2))));
    assert.ok(!plan.appointments.some(other=>other!==item&&other.employee===item.employee&&other.date===item.date&&other.hour<end&&other.hour+plan.services[other.service].minutes/60>item.hour));
  }
});
