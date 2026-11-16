const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ko-KR');
const compact=value=>normalize(value).replace(/\s+/gu,'');
export function createNoteMatcher(note){
 const fields=[note.title,note.text,note.document?.title,...(note.keywords??[])];
 for(const flow of note.flows??[]){fields.push(flow.title);for(const step of flow.steps)fields.push(step.label,...step.actors);}
 const content=fields.map(compact);
 return query=>{
  const terms=normalize(query).trim().split(/\s+/u).filter(Boolean);
  return terms.every(term=>content.some(field=>field.includes(compact(term))));
 };
}

export function matchesNote(note,query){return createNoteMatcher(note)(query);}
