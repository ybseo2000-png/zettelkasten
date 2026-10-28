import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {build,prepareNote} from './build.js';
const note={id:'test-note',title:'검색 연결',text:'검색 키워드의 연결',createdAt:'2026-10-28T00:00:00Z'};
test('Git 메모 파일을 빌드하고 재빌드한다',async()=>{const root=await mkdtemp(tmpdir()+'/gyeol-');try{await mkdir(root+'/notes');await mkdir(root+'/public');await writeFile(root+'/notes/a.json',JSON.stringify(note));await writeFile(root+'/keywords.js','');await writeFile(root+'/public/index.html','<script src="./app.js"></script>');await build(root);await build(root);const data=JSON.parse(await readFile(root+'/dist/notes.json'));assert.equal(data.length,1);assert.ok(data[0].keywords.includes('검색'));}finally{await rm(root,{recursive:true,force:true});}});
test('잘못된 메모와 실행 가능한 이미지를 거부한다',()=>{assert.throws(()=>prepareNote({...note,title:''}));assert.throws(()=>prepareNote({...note,image:'data:image/svg+xml;base64,AAAA'}));});
