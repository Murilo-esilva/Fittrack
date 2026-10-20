// FitTrack Evolution: charts generated as lightweight accessible SVG.
// Records continue to use the existing authenticated Supabase state payload.
(function(){
'use strict';
let selectedExercise='',weightRange='365',editingWeightId=null;
const cleanNumber=(x)=>{const n=Number(String(x??'').replace(',','.'));return Number.isFinite(n)?n:NaN};
const fmt=(n,decimals=1)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
const dateObj=(s)=>new Date(s+'T12:00:00');
const validDay=(s)=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=dateObj(s);return Number.isFinite(d.getTime())&&d.getFullYear()===Number(s.slice(0,4))&&d.getMonth()+1===Number(s.slice(5,7))&&d.getDate()===Number(s.slice(8,10))};
const prettyDate=(s)=>validDay(s)?dateObj(s).toLocaleDateString('pt-BR'):'—';
const shortDate=(s)=>validDay(s)?s.slice(8,10)+'/'+s.slice(5,7):'—';
const allRecords=()=>Array.isArray(db.records)?db.records:[];
const countDays=(days)=>{const d=dateObj(iso());d.setDate(d.getDate()-days+1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const validWeight=(r)=>r&&r.type==='weight'&&validDay(r.date)&&Number.isFinite(cleanNumber(r.bodyWeight))&&cleanNumber(r.bodyWeight)>0;
const weightEntries=()=>allRecords().filter(validWeight).sort((a,b)=>a.date.localeCompare(b.date));
function weeksBack(count){
 const now=dateObj(iso());const weekday=(now.getDay()+6)%7;
 now.setDate(now.getDate()-weekday);
 return Array.from({length:count},(_,i)=>{const d=new Date(now);d.setDate(now.getDate()-7*(count-i-1));
 const key=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 return {key,label:shortDate(key),value:0};});
}
function weekly(type,valueOf){
 const weeks=weeksBack(8),lookup=new Map(weeks.map((w,i)=>[w.key,i]));
 for(const r of allRecords()){
  if(!r||r.type!==type||!validDay(r.date)||r.date>iso())continue;
  const day=dateObj(r.date),shift=(day.getDay()+6)%7;day.setDate(day.getDate()-shift);
  const key=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
  if(lookup.has(key)){const n=valueOf(r);if(Number.isFinite(n)&&n>=0)weeks[lookup.get(key)].value+=n;}
 }
 return weeks;
}
function emptyChart(message){
 return '<div class="evo-empty"><div class="evo-empty-icon" aria-hidden="true">⌁</div><p>'+safe(message)+'</p></div>';
}
function barsSvg(points,label,unit){
 if(!points.some(x=>x.value>0))return emptyChart('Ainda não há registros suficientes para este gráfico.');
 const width=740,height=238,base=189,top=26,left=43,right=22;
 const max=Math.max(1,...points.map(p=>p.value)),peak=Math.ceil(max*1.14)||1;
 let svg='<svg class="evo-chart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+safe(label)+'">';
 svg+='<title>'+safe(label)+'</title>';
 for(let t=0;t<4;t++){
  const val=peak*t/3,y=base-(base-top)*t/3;
  svg+='<line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+(width-right)+'" y2="'+y.toFixed(1)+'" stroke="#31525b" stroke-dasharray="4 6" stroke-width="1"/>';
  svg+='<text x="'+(left-10)+'" y="'+(y+4).toFixed(1)+'" fill="#92b9c0" text-anchor="end" font-size="12">'+fmt(val,val>=10?0:1)+'</text>';
 }
 const slot=(width-right-left)/points.length;
 points.forEach((p,i)=>{
  const barWidth=Math.min(48,slot*.56),x=left+slot*i+(slot-barWidth)/2;
  const h=p.value?Math.max(4,(base-top)*(p.value/peak)):0,y=base-h;
  svg+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+barWidth+'" height="'+h.toFixed(1)+'" rx="8" fill="#38d7bd"/>';
  if(p.value>0)svg+='<text x="'+(x+barWidth/2).toFixed(1)+'" y="'+Math.max(14,y-7).toFixed(1)+'" fill="#e8f6f4" text-anchor="middle" font-size="12" font-weight="700">'+fmt(p.value,unit==='km'?1:0)+'</text>';
  svg+='<text x="'+(x+barWidth/2).toFixed(1)+'" y="'+(base+22)+'" fill="#9bbdc2" text-anchor="middle" font-size="12">'+safe(p.label)+'</text>';
 });
 svg+='</svg>';
 return svg;
}
function lineSvg(points,label,unit,color){
 if(!points.length)return emptyChart('Assim que houver registros, a tendência aparecerá aqui.');
 const pts=points.filter(p=>Number.isFinite(p.value)&&validDay(p.date)).sort((a,b)=>a.date.localeCompare(b.date));
 if(!pts.length)return emptyChart('Nenhum registro válido para este período.');
 const width=740,height=238,left=52,right=23,top=25,bottom=188;
 const vals=pts.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),pad=Math.max((max-min)*.17,unit==='h'?.3:unit==='kg'?0.6:1);
 const minAxis=Math.max(0,min-pad),maxAxis=Math.max(max+pad,minAxis+.5);
 const py=v=>bottom-(v-minAxis)/(maxAxis-minAxis)*(bottom-top);
 const px=i=>pts.length===1?(left+width-right)/2:left+i*(width-right-left)/(pts.length-1);
 const coords=pts.map((p,i)=>[px(i),py(p.value)]);
 let svg='<svg class="evo-chart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+safe(label)+'"><title>'+safe(label)+'</title>';
 for(let t=0;t<4;t++){
  const y=bottom-(bottom-top)*t/3,level=minAxis+(maxAxis-minAxis)*t/3;
  svg+='<line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+(width-right)+'" y2="'+y.toFixed(1)+'" stroke="#31525b" stroke-dasharray="4 6"/>';
  svg+='<text x="'+(left-10)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" font-size="12" fill="#9bbdc2">'+fmt(level,1)+'</text>';
 }
 if(coords.length>1){
  svg+='<polyline points="'+coords.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>';
 }
 coords.forEach((c,i)=>{
  const p=pts[i];
  svg+='<circle cx="'+c[0].toFixed(1)+'" cy="'+c[1].toFixed(1)+'" r="'+(i===coords.length-1?6:4)+'" fill="'+color+'" stroke="#0b2d36" stroke-width="2"><title>'+safe(prettyDate(p.date)+' · '+fmt(p.value,1)+' '+unit)+'</title></circle>';
 });
 const indices=[0,Math.floor((pts.length-1)/2),pts.length-1].filter((i,p,a)=>a.indexOf(i)===p);
 indices.forEach(i=>svg+='<text x="'+px(i).toFixed(1)+'" y="'+(bottom+26)+'" font-size="12" fill="#9bbdc2" text-anchor="'+(i===0&&pts.length>1?'start':i===pts.length-1&&pts.length>1?'end':'middle')+'">'+safe(shortDate(pts[i].date))+'</text>');
 svg+='</svg>';
 return svg;
}
function exerciseOptions(){
 const active=window.FitTrackV4?window.FitTrackV4.plans().flatMap(w=>w.exercises.map((ex,index)=>({
  value:w.key+'::'+ex.id,text:'Treino '+w.key+' · '+ex.name,workout:w.key,id:ex.id,name:ex.name,index
 }))):WORKOUTS.flatMap(w=>w.items.map((ex,index)=>({
  value:w.key+'::legacy:'+ex[0],text:'Treino '+w.key+' · '+ex[0],workout:w.key,name:ex[0],index
 })));
 const opts=[...active],seen=new Set(active.map(o=>o.value));
 for(const r of allRecords()){
  if(!r||r.type!=='training'||!Array.isArray(r.items))continue;
  for(const item of r.items){
   if(!item||typeof item.name!=='string'||!item.name)continue;
   if(item.exerciseId&&active.some(o=>o.workout===r.workout&&o.id===item.exerciseId))continue;
   if(!item.exerciseId&&active.some(o=>o.workout===r.workout&&o.name===item.name))continue;
   const value=r.workout+'::'+(item.exerciseId||'legacy:'+item.name);
   if(seen.has(value))continue;
   seen.add(value);opts.push({
    value,text:'Treino '+r.workout+' · '+item.name+' (histórico)',
    workout:r.workout,id:item.exerciseId||null,name:item.name
   });
  }
 }
 return opts;
}
function exerciseHistory(opt){
 const history=[];
 for(const r of allRecords()){
  if(!r||r.type!=='training'||r.workout!==opt.workout||!validDay(r.date)||!Array.isArray(r.items))continue;
  const item=r.items.find(i=>i&&opt.id&&i.exerciseId===opt.id)||
   r.items.find(i=>i&&!i.exerciseId&&i.name===opt.name);
  if(!item)continue;
  let value=NaN;
  if(Array.isArray(item.sets)){
   const values=item.sets.filter(s=>s&&s.done&&s.weight!==null&&s.weight!==undefined&&s.weight!=='')
    .map(s=>cleanNumber(s.weight)).filter(n=>Number.isFinite(n)&&n>=0);
   if(values.length)value=Math.max(...values);
  }else if((Number(item.done)||0)>0&&item.weight!==null&&item.weight!==undefined&&item.weight!==''){
   value=cleanNumber(item.weight);
  }
  if(Number.isFinite(value)&&value>=0)history.push({date:r.date,value});
 }
 return history.sort((a,b)=>a.date.localeCompare(b.date));
}
function weightWindow(){
 const entries=weightEntries();if(weightRange==='all')return entries;
 const since=countDays(Number(weightRange));return entries.filter(r=>r.date>=since);
}
function metric(label,value,detail){
 return '<div class="evo-metric"><small>'+safe(label)+'</small><strong>'+safe(value)+'</strong><span>'+safe(detail)+'</span></div>';
}
function renderWeightList(){
 const target=document.getElementById('weightHistoryList');if(!target)return;
 const items=[...weightEntries()].reverse().slice(0,6);
 if(!items.length){target.innerHTML='<div class="empty">Nenhum peso registrado. Você pode começar quando quiser.</div>';return;}
 target.innerHTML=items.map(r=>
 '<div class="weight-entry"><div><strong>'+fmt(cleanNumber(r.bodyWeight),1)+' kg</strong><small>'+safe(prettyDate(r.date))+'</small>'+
 (r.notes?'<span class="weight-note">'+safe(r.notes)+'</span>':'')+'</div>'+
 '<div class="weight-actions"><button type="button" class="btn ghost" onclick="editBodyWeight(\''+safe(r.id)+'\')">Editar</button>'+
 '<button type="button" class="btn ghost" onclick="deleteBodyWeight(\''+safe(r.id)+'\')">Excluir</button></div></div>'
 ).join('');
}
function renderEvolution(){
 const section=document.getElementById('evolution');if(!section||section.hidden)return;
 const last30=countDays(30),month=allRecords().filter(r=>r&&validDay(r.date)&&r.date>=last30&&r.date<=iso());
 const training=month.filter(r=>r.type==='training'),bikes=month.filter(r=>r.type==='bike'),recovery=month.filter(r=>r.type==='recovery');
 document.getElementById('evoMetrics').innerHTML=[
  metric('Treinos registrados',String(training.length),'Últimos 30 dias'),
  metric('Séries concluídas',String(training.reduce((n,r)=>n+(Array.isArray(r.items)?r.items.reduce((t,x)=>t+(Number(x.done)||0),0):0),0)),'Últimos 30 dias'),
  metric('Pedal acumulado',fmt(bikes.reduce((n,r)=>n+(cleanNumber(r.distance)||0),0),1)+' km','Últimos 30 dias'),
  metric('Check-ins',String(recovery.length),'Últimos 30 dias')
 ].join('');
 document.getElementById('evoTrainingChart').innerHTML=barsSvg(weekly('training',()=>1),'Treinos concluídos por semana, últimas oito semanas','treinos');
 document.getElementById('evoBikeChart').innerHTML=barsSvg(weekly('bike',r=>cleanNumber(r.distance)),'Quilômetros pedalados por semana, últimas oito semanas','km');
 const opts=exerciseOptions();
 if(!opts.some(o=>o.value===selectedExercise)){
  const withData=opts.find(o=>exerciseHistory(o).length);
  selectedExercise=withData?withData.value:opts[0].value;
 }
 const select=document.getElementById('evoExerciseSelect');
 select.innerHTML=opts.map(o=>'<option value="'+safe(o.value)+'"'+(selectedExercise===o.value?' selected':'')+'>'+safe(o.text)+'</option>').join('');
 const opt=opts.find(o=>o.value===selectedExercise),hist=exerciseHistory(opt);
 document.getElementById('evoLoadChart').innerHTML=lineSvg(hist.slice(-20),'Carga registrada no exercício '+opt.text,'kg','#a3c7ff');
 document.getElementById('evoLoadCaption').textContent=hist.length?'Última carga registrada: '+fmt(hist[hist.length-1].value,1)+' kg · '+prettyDate(hist[hist.length-1].date):'Registre uma carga e ao menos uma série concluída para acompanhar este exercício.';
 const weights=weightWindow().map(r=>({date:r.date,value:cleanNumber(r.bodyWeight)}));
 document.getElementById('evoWeightChart').innerHTML=lineSvg(weights,'Histórico de peso corporal','kg','#e6b9ff');
 document.getElementById('evoWeightRange').value=weightRange;
 const last=weightEntries();const lastWeight=last.length?last[last.length-1]:null;
 document.getElementById('weightLast').textContent=lastWeight?fmt(cleanNumber(lastWeight.bodyWeight),1)+' kg':'Sem registro';
 document.getElementById('weightLastDate').textContent=lastWeight?'Último registro em '+prettyDate(lastWeight.date):'Registre seu peso apenas quando fizer sentido para você.';
 const recoveries=allRecords().filter(r=>r&&r.type==='recovery'&&validDay(r.date)&&Number.isFinite(cleanNumber(r.sleep))&&cleanNumber(r.sleep)>=0).sort((a,b)=>a.date.localeCompare(b.date)).slice(-20).map(r=>({date:r.date,value:cleanNumber(r.sleep)}));
 document.getElementById('evoSleepChart').innerHTML=lineSvg(recoveries,'Horas de sono nos últimos vinte registros','h','#f8c78c');
 renderWeightList();
}
async function saveBodyWeight(event){
 event.preventDefault();
 const form=event.currentTarget,fd=new FormData(form),date=String(fd.get('date')||'');
 const value=cleanNumber(fd.get('bodyWeight')),notes=String(fd.get('notes')||'').trim().slice(0,280);
 if(!validDay(date)||date>iso()){alert('Selecione uma data válida, de hoje ou anterior.');return;}
 if(!Number.isFinite(value)||value<=0||value>700){alert('Informe um peso válido, em quilogramas.');return;}
 const old=editingWeightId?allRecords().find(r=>r.id===editingWeightId&&r.type==='weight'):weightEntries().find(r=>r.date===date);
 if(old){
  if(old!==weightEntries().find(r=>r.date===date)&&weightEntries().some(r=>r.date===date&&r.id!==old.id)){
   alert('Já existe um registro nesta data. Edite ou exclua o registro existente antes de salvar.');return;
  }
  old.date=date;old.bodyWeight=value;old.notes=notes;
 }else{db.records.push({id:uid(),type:'weight',date,bodyWeight:value,notes});}
 document.getElementById('weightSaveBtn').disabled=true;
 try{
  const ok=await persist();
  if(ok){editingWeightId=null;form.reset();form.elements.date.value=iso();document.getElementById('weightSaveBtn').textContent='Salvar registro';document.getElementById('weightCancelBtn').hidden=true;toast('Registro salvo na nuvem');}
  renderEvolution();renderDashboard();
 }finally{document.getElementById('weightSaveBtn').disabled=false;}
}
function editBodyWeight(id){
 const r=allRecords().find(x=>x.id===id&&x.type==='weight');if(!r)return;
 editingWeightId=id;const form=document.getElementById('bodyWeightForm');
 form.elements.date.value=r.date;form.elements.bodyWeight.value=cleanNumber(r.bodyWeight);form.elements.notes.value=r.notes||'';
 document.getElementById('weightSaveBtn').textContent='Atualizar registro';
 document.getElementById('weightCancelBtn').hidden=false;
 form.scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelWeightEdit(){
 editingWeightId=null;const form=document.getElementById('bodyWeightForm');form.reset();form.elements.date.value=iso();
 document.getElementById('weightSaveBtn').textContent='Salvar registro';document.getElementById('weightCancelBtn').hidden=true;
}
async function deleteBodyWeight(id){
 const r=allRecords().find(x=>x.id===id&&x.type==='weight');if(!r)return;
 if(!confirm('Excluir este registro de '+prettyDate(r.date)+'?'))return;
 db.records=db.records.filter(x=>x.id!==id);
 if(editingWeightId===id)cancelWeightEdit();
 await persist();
 renderEvolution();renderDashboard();
}
function renderEvolutionPreview(){
 const node=document.getElementById('evolutionPreview');if(!node)return;
 const weeklyTrain=weekly('training',()=>1),last=weightEntries();
 node.innerHTML='<div class="evo-preview-chart"><div class="eyebrow">TREINOS POR SEMANA</div>'+barsSvg(weeklyTrain,'Treinos das últimas oito semanas','treinos')+'</div>'+
 '<div class="evo-preview-aside">'+
 metric('Semanas com atividades',String(weeklyTrain.filter(w=>w.value>0).length),'Nas últimas oito semanas')+
 metric('Pesos registrados',String(last.length),'Acompanhamento opcional')+
 '</div>';
}
window.renderEvolution=renderEvolution;
window.renderEvolutionPreview=renderEvolutionPreview;
window.editBodyWeight=editBodyWeight;
window.deleteBodyWeight=deleteBodyWeight;
window.cancelWeightEdit=cancelWeightEdit;
window.setExerciseChoice=(value)=>{selectedExercise=value;renderEvolution()};
window.setWeightRange=(value)=>{weightRange=['30','90','365','all'].includes(value)?value:'365';renderEvolution()};
document.getElementById('bodyWeightForm').addEventListener('submit',saveBodyWeight);
})();