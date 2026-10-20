const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const load = file => fs.readFileSync(path.join(root,file), 'utf8');
const safe = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function fixture(){
 const elements = new Map(), notices=[], navigation=[], win={};
 const document = {
  getElementById(id){
   if(!elements.has(id))elements.set(id,{
    id,innerHTML:'',textContent:'',value:'',disabled:false,hidden:id==='v4Editor',
    style:{},focus(){},scrollIntoView(){},setAttribute(){},addEventListener(){},
    elements:{date:{value:''}}
   });
   return elements.get(id);
  },
  querySelectorAll(){return []}
 };
 const workouts=['A','B','C','D','E'].map(letter=>({
  key:letter,name:'Treino '+letter,focus:'Foco',items:[
   ['Exercício '+letter,3,'8–10'],
   ['Segundo '+letter,2,'10–12']
  ]
 }));
 const db={records:[
  {id:'legacy',type:'training',workout:'A',date:'2026-10-17',items:[
   {name:'Exercício A',done:2,weight:'25'}
  ]}
 ],drafts:{A:{0:{weight:'27',done:[true,false,false]}}},weights:{'A:0':'25'}};
 let saves=0,queued=0,gen=0;
 const persist=async()=>{saves++;return true};
 const iso=()=> '2026-10-20';
 const methods=new Function('WORKOUTS','db','selected','document','safe','iso','persist',
   'queueDraftSave','clearDraftSave','uid','confirm','alert','toast','navigate','renderHistory','window',
   load('v4.js')+';return window.FitTrackV4;')(
    workouts,db,'A',document,safe,iso,persist,()=>{queued++},()=>{},
    ()=> 'id-'+(++gen),()=>true,msg=>notices.push(msg),()=>{},page=>navigation.push(page),()=>{},win
   );
 return {db,document,workouts,win,methods,iso,persist,notices,navigation,getSaves:()=>saves,getQueued:()=>queued};
}

test('Syntax: scripts and inline application are valid',()=>{
 for(const path of ['v4.js','evolution.js','cloud.js'])assert.doesNotThrow(()=>new Function(load(path)));
 const html=load('index.html');
 assert.match(html,/src="\.\/v4\.js"/);
 assert.match(html,/id="v4Editor"/);
 const inline=html.split('<script>').at(-1).split('</script>')[0];
 assert.doesNotThrow(()=>new Function(inline));
});

test('V3 draft markers are retained but unrecorded reps stay blank',()=>{
 const f=fixture(),d=f.methods.draft(f.methods.plan('A'));
 assert.equal(d.schemaVersion,4);
 assert.equal(d.byId['A-0'][0].done,true);
 assert.equal(d.byId['A-0'][0].reps,'');
 assert.equal(d.byId['A-0'][0].weight,27);
 assert.equal(f.db.records[0].id,'legacy');
});

test('V4 saves every completed series and does not rewrite legacy sessions',async()=>{
 const f=fixture(),m=f.methods;
 f.document.getElementById('workoutDate').value='2026-10-20';
 m.inputSet(0,0,'reps','9');
 m.inputSet(0,0,'weight','28');
 m.inputSet(0,1,'reps','8');
 m.inputSet(0,1,'weight','30');
 m.toggleSet(0,1);
 await m.finish();
 assert.equal(f.db.records.length,2);
 const r=f.db.records[1];
 assert.equal(r.schemaVersion,4);
 assert.equal(r.items[0].sets[0].weight,28);
 assert.equal(r.items[0].sets[0].reps,9);
 assert.equal(r.items[0].sets[1].weight,30);
 assert.equal(r.items[0].sets[1].done,true);
 assert.equal(r.items[0].done,2);
 assert.equal(f.db.records[0].items[0].weight,'25');
 assert.match(m.historyDetails(r),/repetições\/segundos/);
 assert.equal(f.db.drafts.A,undefined);
 assert.equal(f.getSaves(),1);
});

test('Editor supports rename, reorder, set count and new exercises with stable IDs',async()=>{
 const f=fixture(),m=f.methods;
 m.openEditor();
 m.move(1,-1);
 m.editField(0,'name','Remada personalizada');
 m.editField(0,'sets','4');
 m.add();
 m.editField(2,'name','Exercício extra');
 f.document.getElementById('v4PlanName').value='Upper alterado';
 f.document.getElementById('v4PlanFocus').value='Foco editado';
 await m.savePlan();
 const updated=m.plan('A');
 assert.equal(updated.name,'Upper alterado');
 assert.deepEqual(updated.exercises.map(x=>x.id),['A-1','A-0','id-1']);
 assert.equal(updated.exercises[0].sets,4);
 assert.equal(updated.exercises[2].name,'Exercício extra');
 assert.equal(f.db.records[0].items[0].name,'Exercício A');
 assert.equal(f.getSaves(),1);
});

test('Evolution chart displays both legacy and V4 loads after renaming an exercise',async()=>{
 const f=fixture(),m=f.methods;
 f.document.getElementById('workoutDate').value='2026-10-20';
 m.inputSet(0,0,'reps','9');
 await m.finish();
 m.openEditor();
 m.editField(0,'name','Novo supino');
 f.document.getElementById('v4PlanName').value='Treino A';
 f.document.getElementById('v4PlanFocus').value='Foco';
 await m.savePlan();
 const run=new Function('document','db','WORKOUTS','iso','safe','persist','uid','toast','window','confirm','alert','FormData',
  load('evolution.js')+';return window;');
 run(f.document,f.db,f.workouts,f.iso,safe,f.persist,()=> 'id',()=>{},f.win,()=>true,()=>{},function(){});
 f.document.getElementById('evolution').hidden=false;
 assert.doesNotThrow(()=>f.win.renderEvolution());
 const select=f.document.getElementById('evoExerciseSelect').innerHTML;
 assert.match(select,/Novo supino/);
 assert.match(select,/Exercício A.*histórico/);
 assert.match(f.document.getElementById('evoLoadChart').innerHTML,/<svg/);
});
