// Shared bitmap conversion, preserving the exact glyph geometry of the local demo.
const fs=require('node:fs'),path=require('node:path');
const opentype=require('opentype.js'),{PNG}=require('pngjs');
function normalizeTimestamp(bytes,timestamp){
  const output=Buffer.from(bytes);let head,record;
  for(let i=0;i<output.readUInt16BE(4);i++){const p=12+i*16;if(output.toString('ascii',p,p+4)==='head'){head=output.readUInt32BE(p+8);record=p;break;}}
  if(head===undefined)throw new Error('Font head table missing');
  output.writeBigUInt64BE(BigInt(timestamp),head+20);output.writeBigUInt64BE(BigInt(timestamp),head+28);output.writeUInt32BE(0,head+8);
  const sum=(start,length)=>{let result=0;for(let i=0;i<length;i+=4){let word=0;for(let j=0;j<4;j++)word=(word*256+(i+j<length?output[start+i+j]:0))>>>0;result=(result+word)>>>0;}return result;};
  output.writeUInt32BE(sum(head,output.readUInt32BE(record+12)),record+4);
  output.writeUInt32BE((0xB1B0AFBA-sum(0,output.length))>>>0,head+8);return output;
}
function buildPixelFont(root,hexFile,timestamp='3874365130'){
  const glyphs=[],codes=new Set();
  function makeGlyph(code,rows,width,pixel,ascent,advance){if(codes.has(code))return;codes.add(code);const outline=new opentype.Path();for(let y=0;y<rows.length;y++)for(let x=0;x<width;x++)if(rows[y][x]){let end=x+1;while(end<width&&rows[y][end])end++;const left=x*pixel,right=end*pixel,bottom=(ascent-y-1)*pixel,top=bottom+pixel;outline.moveTo(left,bottom);outline.lineTo(left,top);outline.lineTo(right,top);outline.lineTo(right,bottom);outline.close();x=end-1;}glyphs.push(new opentype.Glyph({name:'uni'+code.toString(16).padStart(4,'0'),unicode:code,advanceWidth:advance,path:outline}));}
  glyphs.push(new opentype.Glyph({name:'.notdef',advanceWidth:768,path:new opentype.Path()}));
  const png=PNG.sync.read(fs.readFileSync(path.join(root,'textures/font/ascii.png')));
  for(let code=32;code<127;code++){const rows=[];let right=0;for(let y=0;y<8;y++){const row=[];for(let x=0;x<8;x++){const on=png.data[(((code>>4)*8+y)*png.width+(code%16)*8+x)*4+3]>0;row.push(on);if(on)right=Math.max(right,x+1);}rows.push(row);}makeGlyph(code,rows,8,128,7,code===32?512:(right+1)*128);}
  for(const line of fs.readFileSync(hexFile,'utf8').split(/\r?\n/)){const [hex,bits]=line.split(':');if(!hex||!bits)continue;const code=parseInt(hex,16);if(code<128||code>65535||code>=0xd800&&code<=0xdfff)continue;const width=bits.length/4,rows=[];if(width!==8&&width!==16)continue;for(let y=0;y<16;y++){const value=parseInt(bits.slice(y*width/4,(y+1)*width/4),16);rows.push(Array.from({length:width},(_,x)=>!!(value&(1<<(width-1-x)))));}makeGlyph(code,rows,width,64,14,width*64+64);}
  const font=new opentype.Font({familyName:'BlockNotes Minecraft Bitmap',styleName:'Regular',unitsPerEm:1024,ascender:896,descender:-256,glyphs});
  const output=path.join(root,'font/minecraft-pixel.otf');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,normalizeTimestamp(font.toArrayBuffer(),timestamp));return{glyphs:glyphs.length,bytes:fs.statSync(output).size};
}
module.exports={buildPixelFont,normalizeTimestamp};
