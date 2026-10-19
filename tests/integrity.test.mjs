import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newState,applyCommand,dispatch,exportSave,importSave,validateState,replayRandom,observe} from '../src/engine.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli=path.join(root,'cli.mjs');
const yn={type:'yn',question:'Does the weather change?'};
function rolls(s,n){return Array.from({length:n},()=>dispatch(s,yn).d6);}
test('saved randomness remains identical through multiple tape boundaries',()=>{
 const s=newState();rolls(s,511);assert.equal(s.random.cursor,512);
 const saved=exportSave(s);const a=importSave(saved),b=importSave(saved);
 assert.deepEqual(rolls(a,1600),rolls(b,1600));assert.deepEqual(a.random,b.random);
});
test('legacy migration preserves every existing future value and derives stable continuation',()=>{
 const s=newState();delete s.random.continuation;
 const values=[...s.random.values],cursor=s.random.cursor;
 const a=importSave(exportSave(s)),b=importSave(exportSave(s));
 assert.deepEqual(a.random.values,values);assert.equal(a.random.cursor,cursor);
 assert.deepEqual(rolls(a,1300),rolls(b,1300));
});
test('explicit replay tape deterministically continues after exhaustion',()=>{
 const a=newState(),b=newState();a.random=replayRandom([0,.5,.99]);b.random=replayRandom([0,.5,.99]);
 const outcomes=rolls(a,800);assert.deepEqual(outcomes,rolls(b,800));assert.deepEqual(outcomes.slice(0,3),[1,4,6]);
 assert.ok(new Set(outcomes).size===6);
});
test('random corruption is rejected instead of producing invalid dice',()=>{
 for(const change of [t=>t.cursor=-1,t=>t.cursor=99999,t=>t.values=[1],t=>t.values=[NaN],t=>t.continuation=[0,0,0,0],t=>t.continuation=[1,2,3]]){
  const s=newState();change(s.random);assert.throws(()=>validateState(s),/random continuation/);
 }
});
test('command IDs survive 750 later commands and export/import',()=>{
 let s=newState();const cmd={id:'first',type:'post',text:'Only once.'};applyCommand(s,cmd);
 for(let i=0;i<750;i++)applyCommand(s,{id:'later-'+i,type:'post',text:'Later.'});
 s=importSave(exportSave(s));const before=exportSave(s);assert.equal(applyCommand(s,cmd).duplicate,true);assert.equal(exportSave(s),before);
 assert.throws(()=>applyCommand(s,{...cmd,text:'Changed'}),/Conflicting/);
});
test('expectedRevision is enforced without an ID, and duplicate retry precedes stale check',()=>{
 const s=newState();assert.throws(()=>applyCommand(s,{type:'post',text:'No',expectedRevision:999}),/Stale/);
 const cmd={id:'once',expectedRevision:s.revision,type:'post',text:'Once'};applyCommand(s,cmd);
 assert.equal(applyCommand(s,cmd).duplicate,true);
});
function run(args){return spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});}
function child(args,env={}){return new Promise(resolve=>{
 const p=spawn(process.execPath,args,{env:{...process.env,...env}});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('close',code=>resolve({code,out,err}));
});}
async function until(file){const stop=Date.now()+5000;while(!fs.existsSync(file)){if(Date.now()>stop)throw Error('Timed out waiting for test barrier');await new Promise(r=>setTimeout(r,10));}}
test('CLI locks BEFORE reading; concurrent writer is rejected then stale retry rejected',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quiet-lock-'));const save=path.join(dir,'save.json');
 try {
 assert.equal(run(['new',save]).status,0);const before=JSON.parse(run(['look',save]).stdout);
 for(const role of ['A','B'])fs.writeFileSync(path.join(dir,role+'.json'),JSON.stringify({id:role,expectedRevision:before.revision,type:'post',text:role}));
 const ready=path.join(dir,'ready'),release=path.join(dir,'release'),hook=path.join(dir,'hook.cjs');
 fs.writeFileSync(hook,`const fs=require('node:fs'); const orig=fs.readFileSync; fs.readFileSync=function(p,...args){const value=orig.call(fs,p,...args);if(String(p)===process.env.SAVE){fs.writeFileSync(process.env.READY,'1');const stop=Date.now()+8000;while(!fs.existsSync(process.env.RELEASE)){if(Date.now()>stop)throw Error('barrier timeout');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}}return value;};`);
 const a=child(['--require',hook,cli,'command',save,path.join(dir,'A.json')],{SAVE:save,READY:ready,RELEASE:release});
 await until(ready);let b;
 try {assert.ok(fs.existsSync(save+'.lock'));b=run(['command',save,path.join(dir,'B.json')]);assert.equal(b.status,1);assert.match(b.stdout,/lock/i);}finally{fs.writeFileSync(release,'1');}
 assert.equal((await a).code,0);assert.equal(fs.existsSync(save+'.lock'),false);
 const retry=run(['command',save,path.join(dir,'B.json')]);assert.equal(retry.status,1);assert.match(retry.stdout,/Stale/);
 const final=JSON.parse(run(['look',save]).stdout);assert.deepEqual(final.thread.messages.filter(m=>m.kind==='journal').map(m=>m.text),['A']);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('concurrent new cannot overwrite the winner; failed command releases lock',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quiet-new-')),save=path.join(dir,'save.json');
 try {
 const results=await Promise.all(['A','B'].map(x=>child([cli,'new',save,x])));
 assert.equal(results.filter(x=>x.code===0).length,1);const winner=JSON.parse(results.find(x=>x.code===0).out).thread.title;
 assert.equal(JSON.parse(run(['look',save]).stdout).thread.title,winner);
 assert.equal(run(['nonsense',save]).status,1);assert.equal(fs.existsSync(save+'.lock'),false);
 assert.equal(run(['post',save,'Still usable']).status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('invalid retry identifiers and revisions fail without changing the save',()=>{
 const s=newState(),before=exportSave(s);
 for(const extra of [{id:{}},{id:""},{expectedRevision:-1},{expectedRevision:1.5},{expectedRevision:"0"}]){
  assert.throws(()=>applyCommand(s,{type:'post',text:'No',...extra}));assert.equal(exportSave(s),before);
 }
});

test('thread-ID collision after deleting a middle thread never overwrites a survivor',()=>{
 const s=newState();s.random=replayRandom(Array(20).fill(.5));
 const a=dispatch(s,{type:'thread.create',title:'A'}).threadId;
 const b=dispatch(s,{type:'thread.create',title:'B'}).threadId;
 dispatch(s,{type:'post',threadId:b,text:'Keep this history'});
 dispatch(s,{type:'thread.delete',threadId:a});
 const c=dispatch(s,{type:'thread.create',title:'C'}).threadId;
 assert.notEqual(c,b);assert.equal(s.threads[b].title,'B');assert.equal(s.threads[b].messages[0].text,'Keep this history');
 assert.equal(new Set(s.order).size,s.order.length);
});
test('inherited object names are not threads or implicit character skills',()=>{
 const s=newState();const before=exportSave(s);
 for(const id of ['__proto__','constructor','toString'])assert.throws(()=>dispatch(s,{type:'thread.rename',threadId:id,title:'bad'}),/No such thread/);
 assert.equal(exportSave(s),before);assert.equal(Object.prototype.title,undefined);
 dispatch(s,{type:'character.define',name:'Tester',skills:{Mending:1}});
 assert.throws(()=>dispatch(s,{type:'check',skill:'constructor',die:20,difficulty:'easy'}),/Pick a skill/);
});
test('explicitly named prototype-like skills safely round-trip and roll numerical bonuses',()=>{
 let s=newState();dispatch(s,{type:'character.define',name:'Tester',skills:JSON.parse('{"__proto__":2}')});
 dispatch(s,{type:'character.skill',skill:'constructor',bonus:3});s=importSave(exportSave(s));
 assert.equal(observe(s).thread.character.skills.__proto__,2);
 for(const [skill,bonus] of [['__proto__',2],['constructor',3]]){
  const result=dispatch(s,{type:'check',skill,die:20,difficulty:'easy'});assert.equal(result.message.bonus,bonus);assert.ok(Number.isFinite(result.total));
 }
});
