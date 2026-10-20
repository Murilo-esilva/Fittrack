/* FitTrack V4 — treino por série e editor de fichas A–E.
 * O estado vive no mesmo payload do Supabase: records, drafts, weights e plans.
 * A função persist() existente continua responsável pela revisão e segurança.
 */
(function(){
"use strict";
const LETTERS=["A","B","C","D","E"];
let editor=null,editing=false,lock=false;
const num=x=>x===""||x===null||x===undefined?null:Number(String(x).replace(",","."));
const validNum=(n,max)=>n!==null&&Number.isFinite(n)&&n>=0&&n<=max;
const fmt=x=>x===null||x===undefined?"":String(x);
const html=s=>safe(s);
const defaults=()=>WORKOUTS.map(w=>({
 key:w.key,name:w.name,focus:w.focus,
 exercises:w.items.map((x,i)=>({id:w.key+"-"+i,name:x[0],sets:x[1],target:x[2]}))
}));
function plans(){
 if(!Array.isArray(db.plans))db.plans=defaults();
 for(const key of LETTERS){
  if(!db.plans.some(p=>p&&p.key===key))
   db.plans.push(defaults().find(p=>p.key===key));
 }
 return LETTERS.map(k=>db.plans.find(p=>p.key===k));
}
function plan(key){return plans().find(p=>p.key===key)||plans()[0]}
function findOldRecordExercise(rec,ex,index){
 if(!rec||!Array.isArray(rec.items))return null;
 return rec.items.find(item=>item&&item.exerciseId===ex.id)||
        rec.items.find(item=>item&&item.name===ex.name)||
        (!rec.schemaVersion?rec.items[index]:null);
}
function previous(w,ex,index){
 const records=db.records.filter(r=>r&&r.type==="training"&&r.workout===w.key&&r.date&&r.date<=iso()).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||"").localeCompare(a.createdAt||""));
 for(const rec of records){
  const item=findOldRecordExercise(rec,ex,index);
  if(!item)continue;
  const sets=Array.isArray(item.sets)?item.sets.filter(s=>s&&s.done):[];
  const oldWeight=num(item.weight);
  if(sets.length||((Number(item.done)||0)>0)){
   return {sets,weight:validNum(oldWeight,1000)?oldWeight:null};
  }
 }
 return {sets:[],weight:null};
}
function defaultRep(target){
 const match=String(target||"").match(/\d+/);
 return match?Number(match[0]):"";
}
function makeSets(w,ex,index){
 const prev=previous(w,ex,index),fallback=num(db.weights[w.key+":"+index]);
 return Array.from({length:ex.sets},(_,i)=>{
  const s=prev.sets[i]||prev.sets[prev.sets.length-1]||{};
  const n=num(s.weight);
  const oldReps=num(s.reps);
  const weight=validNum(n,1000)?n:validNum(prev.weight,1000)?prev.weight:validNum(fallback,1000)?fallback:"";
  const reps=validNum(oldReps,500)&&oldReps>0?oldReps:defaultRep(ex.target);
  return {weight,reps,done:false};
 });
}
function draft(w){
 const data=db.drafts[w.key];
 if(data&&data.schemaVersion===4&&data.byId){
  for(const [i,ex] of w.exercises.entries()){
   if(!Array.isArray(data.byId[ex.id]))data.byId[ex.id]=makeSets(w,ex,i);
   while(data.byId[ex.id].length<ex.sets)data.byId[ex.id].push({weight:"",reps:defaultRep(ex.target),done:false});
   if(data.byId[ex.id].length>ex.sets)data.byId[ex.id].length=ex.sets;
  }
  return data;
 }
 const converted={schemaVersion:4,byId:{}};
 w.exercises.forEach((ex,i)=>{
  const sets=makeSets(w,ex,i);
  const legacy=data&&data[i];
  if(legacy){
   const oldWeight=num(legacy.weight);
   sets.forEach((set,j)=>{
    if(validNum(oldWeight,1000))set.weight=oldWeight;
    if(Array.isArray(legacy.done)&&legacy.done[j]){set.done=true;set.reps="";}
   });
  }
  converted.byId[ex.id]=sets;
 });
 db.drafts[w.key]=converted;
 return converted;
}
function stats(w){
 const d=draft(w),total=w.exercises.reduce((n,e)=>n+e.sets,0);
 const done=w.exercises.reduce((n,e)=>n+(d.byId[e.id]||[]).filter(s=>s.done).length,0);
 return {total,done};
}
function progress(w){
 const {total,done}=stats(w);
 document.getElementById("bar").style.width=(total?100*done/total:0)+"%";
 document.getElementById("progressText").textContent=done+" de "+total+" séries concluídas";
}
function workoutTabs(){
 return plans().map(w=>'<button class="'+(w.key===selected?'active':'')+'" onclick="changeWorkout(\''+w.key+'\')"><b>'+w.key+'</b><small>'+html(w.name)+'</small></button>').join("");
}
function render(){
 if(!document.getElementById("training"))return;
 const w=plan(selected),d=draft(w);
 document.getElementById("workoutTabs").innerHTML=workoutTabs();
 document.getElementById("workoutLetter").textContent="TREINO "+w.key;
 document.getElementById("workoutTitle").textContent=w.name;
 document.getElementById("workoutFocus").textContent=w.focus;
 document.getElementById("exerciseList").innerHTML=w.exercises.map((e,i)=>{
  const rows=(d.byId[e.id]||[]).map((s,j)=>{
   const weight=s.weight===null||s.weight===undefined?"":s.weight;
   const reps=s.reps===null||s.reps===undefined?"":s.reps;
   return '<div class="v4-set-row '+(s.done?'v4-done':'')+'">'+
    '<div class="v4-set-index">S'+(j+1)+'</div>'+
    '<label><span>Carga (kg)</span><input inputmode="decimal" type="number" min="0" max="1000" step=".5" value="'+html(weight)+'" aria-label="Carga da série '+(j+1)+' de '+html(e.name)+'" oninput="FitTrackV4.inputSet('+i+','+j+',\'weight\',this.value)"></label>'+
    '<label><span>Reps / seg</span><input inputmode="numeric" type="number" min="1" max="500" step="1" value="'+html(reps)+'" aria-label="Repetições ou segundos da série '+(j+1)+' de '+html(e.name)+'" oninput="FitTrackV4.inputSet('+i+','+j+',\'reps\',this.value)"></label>'+
    '<button type="button" class="v4-set-toggle '+(s.done?'done':'')+'" aria-pressed="'+Boolean(s.done)+'" onclick="FitTrackV4.toggleSet('+i+','+j+')">'+(s.done?'✓ Feita':'Marcar')+'</button></div>';
  }).join("");
  return '<article class="v4-exercise"><div class="v4-exercise-head"><div><strong>'+html(e.name)+'</strong><span>'+e.sets+' séries · '+html(e.target)+' reps ou segundos</span></div><span class="v4-target">'+(d.byId[e.id]||[]).filter(x=>x.done).length+'/'+e.sets+'</span></div><div class="v4-set-list">'+rows+'</div></article>';
 }).join("");
 progress(w);
}
function changeWorkout(key){
 if(!LETTERS.includes(key)||lock)return;
 if(editing&&!closeEditor())return;
 selected=key;render();
}
function inputSet(exIndex,seriesIndex,field,value){
 if(lock)return;
 const w=plan(selected),ex=w.exercises[exIndex];
 if(!ex||!["weight","reps"].includes(field))return;
 const arr=draft(w).byId[ex.id],s=arr&&arr[seriesIndex];if(!s)return;
 s[field]=value.trim();
 if(s.done){
  const reps=num(s.reps),weight=num(s.weight);
  if(!Number.isInteger(reps)||reps<=0||reps>500||(weight!==null&&!validNum(weight,1000))){
   s.done=false;
   const btn=document.querySelectorAll(".v4-exercise")[exIndex]?.querySelectorAll(".v4-set-toggle")[seriesIndex];
   if(btn){btn.classList.remove("done");btn.textContent="Marcar";btn.setAttribute("aria-pressed","false");}
   progress(w);
  }
 }
 queueDraftSave();
}
function toggleSet(exIndex,seriesIndex){
 if(lock)return;
 const w=plan(selected),ex=w.exercises[exIndex];if(!ex)return;
 const s=draft(w).byId[ex.id][seriesIndex];if(!s)return;
 if(!s.done){
  const r=num(s.reps),weight=num(s.weight);
  if(!Number.isInteger(r)||r<=0||r>500){alert("Informe as repetições (ou os segundos) realizados para marcar a série.");return}
  if(weight!==null&&!validNum(weight,1000)){alert("Informe uma carga válida, ou deixe vazio para exercícios sem carga.");return}
 }
 s.done=!s.done;queueDraftSave();render();
}
async function finish(){
 if(lock||editing)return;
 const w=plan(selected),d=draft(w),date=document.getElementById("workoutDate").value||iso();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>iso()){alert("Informe uma data válida de hoje ou anterior.");return}
 const items=w.exercises.map((ex,index)=>{
  const rows=d.byId[ex.id].map(s=>{
   const weight=num(s.weight),reps=num(s.reps);
   return {weight:weight===null?null:weight,reps:reps===null?null:reps,done:Boolean(s.done)};
  });
  return {exerciseId:ex.id,name:ex.name,target:ex.target,sets:rows,plannedSets:ex.sets,done:rows.filter(s=>s.done).length,
   weight:(()=>{const s=rows.filter(x=>x.done&&x.weight!==null);return s.length?s[s.length-1].weight:null})()};
 });
 if(!items.some(item=>item.done>0)){alert("Marque ao menos uma série concluída.");return}
 for(const item of items)for(const row of item.sets){
  if(row.done&&(!Number.isInteger(row.reps)||row.reps<=0||row.reps>500||(!validNum(row.weight,1000)&&row.weight!==null))){
   alert("Revise as repetições e cargas nas séries concluídas.");return;
  }
 }
 if(!confirm("Salvar treino "+selected+" de "+date+" com "+items.reduce((n,x)=>n+x.done,0)+" séries concluídas?"))return;
 lock=true;
 try{
  clearDraftSave();
  db.records.push({id:uid(),type:"training",schemaVersion:4,date,createdAt:new Date().toISOString(),workout:selected,workoutName:w.name,items});
  for(const [i,item] of items.entries())if(item.done>0&&item.weight!==null)db.weights[selected+":"+i]=item.weight;
  delete db.drafts[selected];
  const ok=await persist();
  if(ok){toast("Treino salvo na nuvem!");render();navigate("dashboard");}
  else{renderHistory();navigate("history");}
 }finally{lock=false}
}
async function reset(){
 if(lock||!confirm("Limpar as marcações e valores deste treino em andamento?"))return;
 clearDraftSave();delete db.drafts[selected];render();await persist();
}
function editorFields(){
 if(!editor)return;
 document.getElementById("v4EditorTitle").textContent="Editar treino "+editor.key;
 document.getElementById("v4PlanName").value=editor.name;
 document.getElementById("v4PlanFocus").value=editor.focus;
 renderEditorList();
}
function renderEditorList(){
 const el=document.getElementById("v4EditorExercises");if(!el||!editor)return;
 el.innerHTML=editor.exercises.map((e,i)=>'<div class="v4-edit-exercise">'+
  '<div class="v4-edit-title"><strong>Exercício '+(i+1)+'</strong><div class="v4-edit-actions">'+
  '<button type="button" aria-label="Mover exercício para cima" onclick="FitTrackV4.move('+i+',-1)" '+(i===0?'disabled':'')+'>↑</button>'+
  '<button type="button" aria-label="Mover exercício para baixo" onclick="FitTrackV4.move('+i+',1)" '+(i===editor.exercises.length-1?'disabled':'')+'>↓</button>'+
  '<button type="button" aria-label="Remover exercício" onclick="FitTrackV4.remove('+i+')" '+(editor.exercises.length===1?'disabled':'')+'>Remover</button></div></div>'+
  '<div class="v4-edit-grid"><label class="v4-edit-name">Nome<input maxlength="65" value="'+html(e.name)+'" oninput="FitTrackV4.editField('+i+',\'name\',this.value)"></label>'+
  '<label>Séries<input type="number" min="1" max="10" step="1" value="'+html(e.sets)+'" oninput="FitTrackV4.editField('+i+',\'sets\',this.value)"></label>'+
  '<label>Reps / tempo<input maxlength="30" value="'+html(e.target)+'" oninput="FitTrackV4.editField('+i+',\'target\',this.value)"></label></div></div>').join("");
}
function editField(index,field,value){
 if(!editor||!editor.exercises[index]||!["name","sets","target"].includes(field))return;
 editor.exercises[index][field]=value;editor.dirty=true;
}
function move(index,step){
 if(!editor)return;
 const next=index+step;if(next<0||next>=editor.exercises.length)return;
 const [item]=editor.exercises.splice(index,1);editor.exercises.splice(next,0,item);editor.dirty=true;renderEditorList();
}
function remove(index){
 if(!editor||editor.exercises.length<=1)return;
 editor.exercises.splice(index,1);editor.dirty=true;renderEditorList();
}
function add(){
 if(!editor||editor.exercises.length>=25){alert("Limite de 25 exercícios por treino.");return}
 editor.exercises.push({id:uid(),name:"",sets:3,target:"8–12"});editor.dirty=true;renderEditorList();
 const inputs=document.querySelectorAll("#v4EditorExercises .v4-edit-name input");inputs[inputs.length-1]?.focus();
}
function openEditor(){
 if(lock)return;
 const p=plan(selected);editor=JSON.parse(JSON.stringify(p));editor.dirty=false;editing=true;
 document.getElementById("v4Editor").hidden=false;document.getElementById("v4TrainingCard").hidden=true;
 editorFields();
}
function closeEditor(force=false){
 if(!editing)return true;
 if(!force&&editor?.dirty&&!confirm("Descartar alterações não salvas da ficha?"))return false;
 editing=false;editor=null;
 document.getElementById("v4Editor").hidden=true;document.getElementById("v4TrainingCard").hidden=false;render();return true;
}
function planValid(p){
 if(!p||!String(p.name).trim()||String(p.name).trim().length>45||String(p.focus).length>120)return "Informe um nome de até 45 caracteres e um foco de até 120 caracteres.";
 if(p.exercises.length<1||p.exercises.length>25)return "Informe de 1 a 25 exercícios.";
 const names=new Set();
 for(const e of p.exercises){
  const name=String(e.name).trim(),target=String(e.target).trim(),count=Number(e.sets);
  if(!name||name.length>65||!target||target.length>30||!Number.isInteger(count)||count<1||count>10)return "Confira nome, séries (1 a 10) e repetições/tempo dos exercícios.";
  if(names.has(name.toLocaleLowerCase("pt-BR")))return "Evite nomes duplicados na mesma ficha.";
  names.add(name.toLocaleLowerCase("pt-BR"));
 }
 return "";
}
async function savePlan(){
 if(!editor||lock)return;
 const p=JSON.parse(JSON.stringify(editor));
 p.name=document.getElementById("v4PlanName").value.trim();
 p.focus=document.getElementById("v4PlanFocus").value.trim();
 p.exercises=p.exercises.map(e=>({...e,name:String(e.name).trim(),target:String(e.target).trim(),sets:Number(e.sets)}));
 const error=planValid(p);
 if(error){alert(error);return}
 const existing=plan(selected);
 const oldDraft=db.drafts[selected];
 const removed=existing.exercises.filter(e=>!p.exercises.some(n=>n.id===e.id));
 if(removed.length&&oldDraft?.byId&&removed.some(e=>oldDraft.byId[e.id]?.some(s=>s.done))){
  if(!confirm("Você removeu exercícios com séries marcadas no treino em andamento. Continuar e descartar essas marcações?"))return;
 }
 lock=true;document.getElementById("v4SavePlan").disabled=true;
 try{
  clearDraftSave();
  db.plans=plans().map(w=>w.key===p.key?{key:p.key,name:p.name,focus:p.focus,exercises:p.exercises}:w);
  const d=db.drafts[selected];
  if(d?.byId){
   for(const id of Object.keys(d.byId))if(!p.exercises.some(ex=>ex.id===id))delete d.byId[id];
   for(const ex of p.exercises)if(d.byId[ex.id])d.byId[ex.id].length=Math.min(d.byId[ex.id].length,ex.sets);
  }
  const ok=await persist();
  if(ok){closeEditor(true);toast("Ficha salva na nuvem!");}
  else{alert("A ficha continua nesta aba, mas houve erro no salvamento. Exporte um backup antes de sair.");closeEditor(true);}
 }finally{lock=false;document.getElementById("v4SavePlan").disabled=false;}
}
function onPlanInfo(field,value){if(editor){editor[field]=value;editor.dirty=true}}
function onLoad(){plans();if(editing)closeEditor(true);render()}

function historyDetails(record){
 if(!record||!Array.isArray(record.items))return "";
 const list=record.items.filter(i=>i&&(Number(i.done)>0||(Array.isArray(i.sets)&&i.sets.some(s=>s?.done))));
 if(!list.length)return '<p>Nenhuma série concluída registrada.</p>';
 return list.map(item=>{
  const sets=Array.isArray(item.sets)?item.sets.filter(s=>s&&s.done):null;
  if(sets){
   const rows=sets.map((set,i)=>{
    const weight=num(set.weight),reps=num(set.reps);
    return '<li>Série '+(i+1)+': '+(Number.isFinite(reps)?reps+' repetições/segundos':'repetições não anotadas')+
       (validNum(weight,1000)?' · '+weight.toLocaleString('pt-BR')+' kg':' · sem carga informada')+'</li>';
   });
   return '<div><p><strong>'+html(item.name)+'</strong></p><ul>'+rows.join('')+'</ul></div>';
  }
  const count=Math.max(0,Number(item.done)||0),weight=num(item.weight);
  return '<p><strong>'+html(item.name)+'</strong> — '+count+' séries concluídas'+
     (validNum(weight,1000)?' · carga '+weight.toLocaleString('pt-BR')+' kg':'')+' (registro anterior à V4)</p>';
 }).join("");
}

window.FitTrackV4={
 plans,plan,draft,render,changeWorkout,inputSet,toggleSet,finish,reset,openEditor,closeEditor,
 editField,move,remove,add,savePlan,onPlanInfo,onLoad,previous,historyDetails
};
})();