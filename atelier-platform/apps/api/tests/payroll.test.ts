import {test} from 'node:test';
import assert from 'node:assert/strict';
import {payrollPeriods,proratedBase} from '../src/services/payroll.js';
test('payroll periods use calendar months, seven-day weeks and explicit 15-day cycles',()=>{
  assert.deepEqual(payrollPeriods('2026-01-30','2026-02-01','monthly'),[{start:'2026-01-30',end:'2026-01-31'},{start:'2026-02-01',end:'2026-02-28'}]);
  assert.deepEqual(payrollPeriods('2026-11-01','2026-11-08','weekly'),[{start:'2026-11-01',end:'2026-11-07'},{start:'2026-11-08',end:'2026-11-14'}]);
  assert.deepEqual(payrollPeriods('2026-11-01','2026-11-16','biweekly'),[{start:'2026-11-01',end:'2026-11-15'},{start:'2026-11-16',end:'2026-11-30'}]);
  assert.equal(payrollPeriods('2026-11-01','2026-11-03','daily').length,3);
  assert.deepEqual(payrollPeriods('2026-12-01','2026-11-30','monthly'),[]);
});
test('monthly salary proration handles partial months, leap years and month crossings',()=>{
  assert.equal(proratedBase(300000,'2026-11-01','2026-11-30'),300000);
  assert.equal(proratedBase(300000,'2026-11-01','2026-11-15'),150000);
  assert.equal(proratedBase(290000,'2028-02-01','2028-02-29'),290000);
  assert.equal(proratedBase(310000,'2026-01-31','2026-02-01'),21071);
});
