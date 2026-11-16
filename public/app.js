import {animateEntrance} from './entrance.js';
import {createNoteMatcher} from './search.js';
const $=s=>document.querySelector(s);let notes=[],view='graph',zoom=1;
let stopEntrance=()=>{};
let graphData,graphGroup,zoomFrame=0,lastCardQuery=null;
const graphNodes=new Map(),graphLines=[],matchers=new Map();
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());

function renderFlows(note){
 const wrapper=el('section',undefined,'procedure');wrapper.setAttribute('aria-label','절차 순서도');
 const columns=el('div',undefined,'flow-columns');
 note.flows.forEach(flow=>{const column=el('section',undefined,'flow-column');column.append(el('h3',flow.title));const list=el('ol',undefined,'flow-steps');flow.steps.forEach((step,i)=>{const item=el('li',undefined,'flow-step'+(step.optional?' optional':''));item.append(el('span',String(i+1).padStart(2,'0'),'step-number'),el('strong',step.label));if(step.optional)item.append(el('span','필요시','optional-label'));if(step.actors.length)item.append(el('p',step.actors.join(' · '),'step-actors'));list.append(item);});column.append(list);columns.append(column);});
 wrapper.append(columns);
 const original=el('details',undefined,'flow-original');original.append(el('summary','내용 보기'),el('div',note.text,'note-text'));wrapper.append(original);return wrapper;
}
function renderDocument(note){
 const section=el('section',undefined,'pdf-document');
 const link=el('a','PDF 새 탭에서 열기 ↗','pdf-link');link.href='./'+note.document.path;link.target='_blank';link.rel='noopener';
 section.append(link,el('p','아래에서 문서를 읽을 수 있습니다. PDF가 표시되지 않으면 새 탭에서 열어주세요.','pdf-help'));
 const frame=el('iframe');frame.src='./'+note.document.path+'#view=FitH';frame.title=note.document.title;frame.className='pdf-frame';section.append(frame);return section;
}
function show(note){const body=$('#detailBody');$('#detail').classList.toggle('has-flow',Boolean(note.flows));$('#detail').classList.toggle('has-document',Boolean(note.document));body.replaceChildren(el('h2',note.title),el('p',new Date(note.createdAt).toLocaleDateString('ko-KR'),'date'),note.flows?renderFlows(note):el('div',note.text,'note-text'));if(note.document)body.append(renderDocument(note));if(note.image){const img=el('img');img.src=note.image;img.alt=note.title;body.append(img);}const tags=el('p');note.keywords.forEach(k=>tags.append(el('span','#'+k,'tag')));body.append(tags);const related=notes.filter(n=>n.id!==note.id&&n.keywords.some(k=>note.keywords.includes(k)));if(related.length){body.append(el('h3','이어지는 생각'));related.forEach(n=>{const b=el('button',n.title,'card');b.onclick=()=>show(n);body.append(b);});}if(!$('#detail').open)$('#detail').showModal();}
function render(){
 const q=$('#search').value;
 const filtered=notes.filter(note=>matchers.get(note.id)(q));
 $('#count').textContent=q.trim()?filtered.length+'개 검색됨 / 전체 '+notes.length+'개':notes.length+'개의 메모';
 $('#garden').hidden=view!=='graph';$('#cards').hidden=view!=='list';
 $('#empty').style.display=filtered.length?'none':'flex';
 $('#empty h2').textContent=notes.length?'검색 결과가 없습니다':'아직 등록된 메모가 없습니다';
 const visible=new Set(filtered.map(note=>note.id));
 for(const [id,element] of graphNodes)element.style.display=visible.has(id)?'':'none';
 for(const {source,target,element} of graphLines)element.style.display=visible.has(source)&&visible.has(target)?'':'none';
 if(view==='list'&&lastCardQuery!==q){
  lastCardQuery=q;const cards=document.createDocumentFragment();
  for(const note of filtered){
   const button=el('button',undefined,'card');button.append(el('h3',note.title));
   if(note.document)button.append(el('span','PDF','tag'));
   button.append(el('p',note.text.slice(0,100)||'이미지 메모'));
   note.keywords.slice(0,3).forEach(keyword=>button.append(el('span','#'+keyword,'tag')));
   button.onclick=()=>show(note);cards.append(button);
  }
  $('#cards').replaceChildren(cards);
 }
}
const ns='http://www.w3.org/2000/svg';
function svg(tag,attrs){const element=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))element.setAttribute(key,value);return element;}
function applyZoom(){if(graphGroup)graphGroup.setAttribute('transform',`translate(500 325) scale(${zoom}) translate(-500 -325)`);}
function draw(){
 const graph=$('#graph');graph.replaceChildren();graph.setAttribute('viewBox','0 0 1000 650');
 graphGroup=svg('g',{});graph.append(graphGroup);applyZoom();
 const noteById=new Map(notes.map(note=>[note.id,note]));
 const positions=graphData.nodes.map(node=>({...node,n:noteById.get(node.id)}));
 const indices=new Map(positions.map((node,i)=>[node.id,i]));
 const links=graphData.links.map(link=>({...link,a:indices.get(link.source),b:indices.get(link.target)}));
 const nodeElements=[],lineElements=[];
 for(const link of links){
  const a=positions[link.a],b=positions[link.b];
  const line=svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#aaaaaa','stroke-width':Math.min(4,link.shared.length),'stroke-opacity':'.6'});
  const title=svg('title',{});title.textContent=link.shared.join(', ');line.append(title);graphGroup.append(line);
  graphLines.push({...link,element:line});lineElements.push(line);
 }
 for(const {x,y,n:note,degree,radius,fill} of positions){
  const group=svg('g',{class:'node',tabindex:'0',role:'button','aria-label':note.title+' · 연결 '+degree+'개',transform:`translate(${x} ${y})`});
  const info=svg('title',{});info.textContent=note.title+' · 연결 '+degree+'개';
  group.append(info,svg('circle',{r:radius+7,fill:'#ededed'}),svg('circle',{r:radius,fill,stroke:'#888888','stroke-width':.7}));
  const text=svg('text',{y:radius+25,'text-anchor':'middle'});text.textContent=note.title.length>19?note.title.slice(0,19)+'…':note.title;group.append(text);
  group.onclick=()=>show(note);group.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show(note);}};
  graphGroup.append(group);graphNodes.set(note.id,group);nodeElements.push(group);
 }
 stopEntrance=animateEntrance(positions,links,nodeElements,lineElements,{reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches});
}
$('#graph').addEventListener('wheel',event=>{
 event.preventDefault();stopEntrance();stopEntrance=()=>{};
 zoom=Math.max(.5,Math.min(3,zoom*(event.deltaY<0?1.1:.9)));
 if(!zoomFrame)zoomFrame=requestAnimationFrame(()=>{zoomFrame=0;applyZoom();});
},{passive:false});
$('#search').oninput=render;$('#graphView').onclick=()=>setView('graph');$('#listView').onclick=()=>setView('list');function setView(v){view=v;$('#graphView').classList.toggle('active',v==='graph');$('#listView').classList.toggle('active',v==='list');render();}
try{
 const responses=await Promise.all([fetch('./notes.json'),fetch('./graph.json')]);
 if(responses.some(response=>!response.ok))throw Error('Site data unavailable');
 [notes,graphData]=await Promise.all(responses.map(response=>response.json()));
 notes.forEach(note=>matchers.set(note.id,createNoteMatcher(note)));
 draw();render();
}catch(error){console.error(error);$('#empty h2').textContent='메모를 불러오지 못했습니다';$('#empty p').textContent='서버 연결을 확인하고 새로고침해주세요.';}
