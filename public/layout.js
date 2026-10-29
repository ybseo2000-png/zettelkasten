// Count distinct connected notes across the full garden, so search does not alter importance.
export function nodeMetrics(items){
 const index=new Map(),neighbors=new Map(items.map(n=>[n.id,new Set()]));
 for(const note of items)for(const keyword of new Set(note.keywords)){
  if(!index.has(keyword))index.set(keyword,new Set());index.get(keyword).add(note.id);
 }
 for(const ids of index.values())for(const id of ids)for(const other of ids)if(id!==other)neighbors.get(id).add(other);
 const maxDegree=Math.max(1,...[...neighbors.values()].map(connected=>connected.size));
 return new Map([...neighbors].map(([id,connected])=>{
  const degree=connected.size,t=degree/maxDegree;
  const pale=[255,249,219],deep=[229,173,0];
  const fill='#'+pale.map((c,i)=>Math.round(c+(deep[i]-c)*t).toString(16).padStart(2,'0')).join('');
  return [id,{degree,radius:14,fill}];
 }));
}
// Deterministic force layout: shared keywords pull notes into visible groups.
export function layout(items){
 const nodes=items.map((n,i)=>({n,x:500+Math.cos(i*2.39996)*Math.sqrt(i+1)*24,y:325+Math.sin(i*2.39996)*Math.sqrt(i+1)*24}));
 const links=[];const index=new Map();
 nodes.forEach((node,i)=>node.n.keywords.forEach(k=>{if(!index.has(k))index.set(k,[]);index.get(k).push(i);}));
 const pairs=new Map();for(const [keyword,ids]of index)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const key=ids[i]+':'+ids[j];if(!pairs.has(key))pairs.set(key,{a:ids[i],b:ids[j],shared:[]});pairs.get(key).shared.push(keyword);}
 links.push(...pairs.values());
 for(let step=0;step<140;step++){
  const forces=nodes.map(n=>({x:(500-n.x)*.009,y:(325-n.y)*.009}));
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],dx=a.x-b.x,dy=a.y-b.y,d2=Math.max(dx*dx+dy*dy,100);const force=1100/d2;const d=Math.sqrt(d2);forces[i].x+=dx/d*force;forces[i].y+=dy/d*force;forces[j].x-=dx/d*force;forces[j].y-=dy/d*force;}
  for(const link of links){const a=nodes[link.a],b=nodes[link.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),f=(d-105)*.012;forces[link.a].x+=dx/d*f;forces[link.a].y+=dy/d*f;forces[link.b].x-=dx/d*f;forces[link.b].y-=dy/d*f;}
  nodes.forEach((n,i)=>{n.x+=Math.max(-8,Math.min(8,forces[i].x));n.y+=Math.max(-8,Math.min(8,forces[i].y));});
 }
 if(nodes.length>1){const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y);const minX=Math.min(...xs),minY=Math.min(...ys),width=Math.max(...xs)-minX,height=Math.max(...ys)-minY;const scale=Math.min(800/Math.max(width,1),470/Math.max(height,1),2);nodes.forEach(n=>{n.x=500+(n.x-minX-width/2)*scale;n.y=310+(n.y-minY-height/2)*scale;});}
 return {nodes,links};
}
