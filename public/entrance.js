// A small, damped displacement creates a settling motion without moving final layout positions.
export function entrancePositions(nodes,progress){
 const t=Math.max(0,Math.min(1,progress));
 const decay=(1-t)**3;
 return nodes.map((node,i)=>{
  const angle=i*2.399963;
  const wave=Math.cos(t*Math.PI*4)*decay;
  return {x:node.x+Math.cos(angle)*(32+i%4*8)*wave,y:node.y+Math.sin(angle+.7)*(24+i%3*7)*wave};
 });
}
export function animateEntrance(nodes,links,nodeElements,lineElements,{reducedMotion=false,requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame}={}){
 const paint=points=>{
  nodeElements.forEach((element,i)=>element.setAttribute('transform',`translate(${points[i].x} ${points[i].y})`));
  lineElements.forEach((element,i)=>{const {a,b}=links[i];for(const [key,value] of Object.entries({x1:points[a].x,y1:points[a].y,x2:points[b].x,y2:points[b].y}))element.setAttribute(key,value);});
 };
 if(reducedMotion||nodes.length<2){paint(nodes);return ()=>{};}
 let frame,start=null,stopped=false;
 paint(entrancePositions(nodes,0));
 const tick=time=>{if(stopped)return;if(start===null)start=time;const progress=Math.min(1,(time-start)/1600);paint(entrancePositions(nodes,progress));if(progress<1)frame=requestFrame(tick);};
 frame=requestFrame(tick);
 return ()=>{stopped=true;cancelFrame(frame);paint(nodes);};
}
