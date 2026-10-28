import http from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('./dist/',import.meta.url);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/layout.js':'layout.js','/style.css':'style.css','/keywords.js':'keywords.js','/notes.json':'notes.json'};
 if(req.method!=='GET'||!Object.hasOwn(files,path)){res.writeHead(404);return res.end('Not found');}
 try{const file=files[path];const data=await readFile(new URL(file,root));res.writeHead(200,{'Content-Type':types[file.slice(file.lastIndexOf('.'))],'X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(500);res.end('Run npm run build first');}
}).listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Static knowledge garden ready'));
