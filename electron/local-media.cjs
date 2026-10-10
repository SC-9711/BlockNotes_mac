const fs=require('node:fs');
const {Readable}=require('node:stream');
// Serve byte ranges so Chromium can find Vorbis duration and seek locally.
// The caller validates the file is inside the selected local asset root.
function serveAudio(file,request){
 const size=fs.statSync(file).size,range=request.headers.get('range');
 let start=0,end=size-1,status=200;
 const headers={'Content-Type':'audio/ogg','Accept-Ranges':'bytes'};
 if(range){
  const parts=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!parts||!size||!parts[1]&&!parts[2])return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  start=parts[1]?Number(parts[1]):Math.max(0,size-Number(parts[2]));
  end=parts[1]&&parts[2]?Math.min(size-1,Number(parts[2])):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 }
 headers['Content-Length']=String(Math.max(0,end-start+1));
 const body=request.method==='HEAD'||!size?null:Readable.toWeb(fs.createReadStream(file,{start,end}));
 return new Response(body,{status,headers});
}
module.exports={serveAudio};
