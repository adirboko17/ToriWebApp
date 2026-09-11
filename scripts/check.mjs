import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const out=path.resolve('.test-build');await mkdir(out,{recursive:true});
for(const name of ['booking-step','availability','phone']){const source=(await readFile(`lib/${name}.ts`,'utf8')).replace("'./booking-step'","'./booking-step.mjs'");await writeFile(path.join(out,`${name}.mjs`),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);}
const {calculateSlots,israelNow}=await import(pathToFileURL(path.join(out,'availability.mjs')));
const {parseIsraeliMobileNational10,phonesMatch}=await import(pathToFileURL(path.join(out,'phone.mjs')));
const base={date:'2026-09-10',weekly:{start_time:'09:00',end_time:'12:00',is_active:true,slot_duration_minutes:15},override:null,constraints:[],busy:[],duration:30,gap:0,user:null,now:new Date('2026-09-09T12:00:00Z')};
assert.equal(calculateSlots(base).length,11);
assert.deepEqual(calculateSlots({...base,override:{is_active:false}}),[]);
assert.deepEqual(calculateSlots({...base,weekly:{is_active:false},override:{is_active:true,start_time:'10:00',end_time:'11:00',breaks:[]}}),['10:00','10:15','10:30']);
assert(!calculateSlots({...base,constraints:[{start_time:'10:00',end_time:'11:00'}]}).includes('09:45'));
assert(!calculateSlots({...base,weekly:{...base.weekly,breaks:[{start_time:'10:00',end_time:'11:00'}]}}).includes('10:15'));
const busy=[{is_available:false,slot_time:'10:00',duration_minutes:30}];
assert(!calculateSlots({...base,busy,gap:15}).includes('09:30'));
assert(!calculateSlots({...base,busy,gap:15}).includes('10:30'));
assert(calculateSlots({...base,busy,gap:15}).includes('10:45'));
assert.deepEqual(calculateSlots({...base,user:{booking_allowed_weekdays:[0]}}),[]);
assert.deepEqual(calculateSlots({...base,user:{booking_allowed_from:'10:00',booking_allowed_until:'10:30'}}),['10:00','10:15','10:30']);
assert(calculateSlots({...base,weekly:{...base.weekly,start_time:'09:40'}}).includes('09:45'));
assert.equal(israelNow(new Date('2026-09-09T22:30:00Z')).date,'2026-09-10');
assert.equal(parseIsraeliMobileNational10('+972 50-123-4567'),'0501234567');assert(phonesMatch('0501234567','+972501234567'));
assert.deepEqual(calculateSlots({...base,date:'2026-09-08'}),[]);
console.log('15 availability, timezone and phone checks passed.');
if(process.argv.includes('--integration')){
const origin=process.env.TORI_TEST_ORIGIN||'http://localhost:3017';const results=[];
for(const slug of ['tori','linbitton','shirlavy']){const response=await fetch(`${origin}/api/b/${slug}/bootstrap`);assert.equal(response.status,200);const data=await response.json();assert.equal(data.user,null);assert(data.services.every(s=>s.business_id===data.profile.id));assert(!JSON.stringify(data).includes('password_hash'));results.push({slug,id:data.profile.id,color:data.profile.primary_color});}
assert.equal(new Set(results.map(r=>r.id)).size,3);
for(const action of ['appointments','admin','waitlist','notifications']){const response=await fetch(`${origin}/api/b/tori/${action}`);assert.equal(response.status,401);}
assert.equal((await fetch(`${origin}/api/b/missing-business/bootstrap`)).status,404);
const forged='tori_session='+Buffer.from(JSON.stringify({userId:'c1a7476b-3608-43b4-92b3-0e3522efaaae',businessId:results[0].id,exp:Date.now()+60000})).toString('base64url')+'.forged';assert.equal((await fetch(`${origin}/api/b/tori/admin`,{headers:{cookie:forged}})).status,401);
assert.equal((await fetch(`${origin}/api/b/tori/book`,{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json'},body:'{}'})).status,403);
console.log('Read-only tenant isolation and access checks passed:',results.map(({slug,color})=>({slug,color})));
}
