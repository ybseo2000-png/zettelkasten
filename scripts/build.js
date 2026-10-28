import {readFile,writeFile,mkdir,readdir,copyFile,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {keywords} from '../keywords.js';
export function prepareNote(input){
 if(!input || typeof input.id!=='string'||!/^[a-zA-Z0-9-]+$/.test(input.id)||typeof input.title!=='string'||!input.title.trim()||input.title.length>120||typeof input.text!=='string'||input.text.length>20000||(!input.text.trim()&&!input.image)||!Number.isFinite(Date.parse(input.createdAt)))throw Error('메모 형식이 올바르지 않습니다.');
 if(input.image&&(typeof input.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image)||input.image.length>7_000_000))throw Error('지원하지 않는 이미지입니다.');
 return {id:input.id,title:input.title.trim(),text:input.text,image:input.image||'',createdAt:input.createdAt,keywords:keywords(input.title+' '+input.text)};
}
export async function build(root){
 const notes=[];const ids=new Set();
 for(const file of (await readdir(root+'/notes')).filter(n=>n.endsWith('.json')).sort()){
  try{const note=prepareNote(JSON.parse(await readFile(root+'/notes/'+file,'utf8')));if(ids.has(note.id))throw Error('중복 메모 ID');ids.add(note.id);notes.push(note);}catch(e){throw Error(file+': '+e.message);}
 }
 notes.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 await mkdir(root+'/dist',{recursive:true});await cp(root+'/public',root+'/dist',{recursive:true});await copyFile(root+'/keywords.js',root+'/dist/keywords.js');await writeFile(root+'/dist/notes.json',JSON.stringify(notes));await writeFile(root+'/dist/.nojekyll','');console.log(`Built ${notes.length} notes → dist/`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build(fileURLToPath(new URL('..',import.meta.url)));
