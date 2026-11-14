/* Deterministic offline tests for all room counts and key player choices. */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('gallery-blackout-rules.js','utf8'),context);
const R=context.window.OIBUNG_BLACKOUT_RULES;
assert.ok(R&&typeof R.begin==='function');

for(let count=1;count<=30;count++){
 const g=R.begin(count,0);
 assert.equal(g.count,count);
 assert.ok(g.room>=0&&g.room<count);
 assert.ok(g.powerRoom>=0&&g.powerRoom<count);
 assert.equal(g.fuses.length,new Set(g.fuses).size,'No duplicate fuses');
 assert.ok(g.fuses.every(x=>x>=0&&x<count));
 assert.ok(g.fuses.length>=1);
 assert.equal(g.found.length,0);
 assert.equal(g.phase,'search');
 assert.equal(g.torch,true);
 assert.equal(g.finished,false);
}

const normal=R.begin(5,0);
assert.equal(normal.powerRoom,3);
assert.equal(normal.fuses.length,2);
const quiet=R.begin(5,0);
R.toggleQuiet(quiet);
R.move(normal,1);R.move(quiet,1);
assert.ok(quiet.noise<normal.noise,'Silent footstep must be less noisy');
assert.ok(quiet.alert<normal.alert,'Quiet movement reduces suspicion');

const risk=R.begin(5,0);
const riskBefore=risk.alert;
R.toggleTorch(risk);assert.equal(risk.torch,false);
assert.ok(risk.alert<=riskBefore);
R.move(risk,1);
const denied=R.collect(risk);assert.equal(denied.type,'blocked','Darkness prevents fuse pickup');
R.toggleTorch(risk);assert.equal(risk.torch,true);
assert.equal(R.collect(risk).type,'collected','Pick up visible fuse');
assert.equal(R.collect(risk).type,'blocked','No repeat fuse pickup');
R.move(risk,2);
assert.equal(R.collect(risk).type,'collected');
R.move(risk,3);
if(risk.phase==='warning'){
 assert.equal(R.power(risk).type,'blocked','Cannot operate breaker in danger');
 assert.equal(R.hide(risk).type,'hide');
 assert.equal(R.wait(risk).type,'safe');
}
assert.equal(R.power(risk).type,'panel','Install fuses first');
assert.equal(risk.panel,1);
assert.equal(R.power(risk).type,'restored','Second power action restores lights');
assert.equal(risk.finished,true);

const caught=R.begin(3,0);
R.move(caught,2);
assert.equal(caught.phase,'warning');
assert.equal(R.wait(caught).type,'caught','Waiting in front of a monster results in capture');
assert.equal(caught.finished,true);

const hide=R.begin(3,0);
R.move(hide,2);
assert.equal(R.hide(hide).type,'hide');
assert.equal(R.wait(hide).type,'safe');
assert.equal(hide.hidden,false);
assert.equal(hide.phase,'search');

const single=R.begin(1,0);
assert.equal(R.collect(single).type,'collected','One-work exhibition remains playable');
assert.equal(R.power(single).type,'panel');
assert.equal(R.power(single).type,'restored');

const newcomer=R.begin(8,2);
for(let i=0;i<6;i++)R.tick(newcomer);
assert.ok(newcomer.monster>=0&&newcomer.monster<newcomer.count);
console.log('PASS blackout rules: 1–30 rooms, noise, flashlight, fuse puzzle, patrol, fair capture, hide and power');
