export function imageData(value,maxBytes=500*1024){
  if(typeof value!=='string'||value.length>Math.ceil(maxBytes*4/3)+100)return null;
  const match=value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);if(!match)return null;
  try{
    const bytes=atob(match[2]);if(bytes.length>maxBytes)return null;
    const valid=match[1]==='image/png'?bytes.startsWith('\x89PNG\r\n\x1a\n')&&bytes.length>=24&&bytes.slice(12,16)==='IHDR':match[1]==='image/jpeg'?bytes.startsWith('\xff\xd8\xff')&&bytes.endsWith('\xff\xd9'):bytes.length>=20&&bytes.slice(0,4)==='RIFF'&&bytes.slice(8,12)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(bytes.slice(12,16));
    return valid?{mime:match[1],base64:match[2],bytes}:null;
  }catch{return null;}
}
