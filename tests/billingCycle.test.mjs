import test from 'node:test';
import assert from 'node:assert/strict';
import {getUpcomingRenewal,renewalReminderDate,validYmd} from '../src/utils/billingCycle.js';

test('fecha mensual normal con 3 días de aviso',()=>{
  assert.deepEqual(getUpcomingRenewal('2025-03-11','2026-11-08'),{
    dueYmd:'2026-11-11',periodId:'2026-11',daysUntil:3
  });
  assert.equal(renewalReminderDate('2025-03-11','2026-11-08').daysUntil,3);
  assert.equal(renewalReminderDate('2025-03-11','2026-11-07'),null);
});
test('día 31 no se desborda en febrero y considera año bisiesto',()=>{
  assert.equal(getUpcomingRenewal('2024-01-31','2024-02-25').dueYmd,'2024-02-29');
  assert.equal(getUpcomingRenewal('2025-01-31','2025-02-25').dueYmd,'2025-02-28');
  assert.equal(getUpcomingRenewal('2025-01-31','2025-02-28').daysUntil,0);
});
test('no anticipar fechas futuras, mes/año siguiente y año nuevo',()=>{
  assert.equal(getUpcomingRenewal('2027-04-10','2026-11-08').dueYmd,'2027-04-10');
  assert.equal(getUpcomingRenewal('2025-12-03','2026-12-25').dueYmd,'2027-01-03');
});
test('fechas invalidas rechazadas',()=>{
  assert.equal(validYmd('2026-02-30'),false);
  assert.equal(validYmd('2024-02-29'),true);
  assert.equal(getUpcomingRenewal('fecha rara','2026-11-08'),null);
});
