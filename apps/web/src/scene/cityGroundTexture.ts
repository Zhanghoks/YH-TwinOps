/** Original world-aligned urban ground atlas: streets, parcels, roofs and parks.
 * No aerial/photo asset. Near and distant atlases sample the same world function. */
export function cityGroundColor(x:number,z:number,width:number,depth:number):readonly[number,number,number] {
 const ax=Math.abs(x),az=Math.abs(z),w=width/2,d=depth/2;
 const noise=((Math.imul(Math.floor(x*2)+10007,374761393)^Math.imul(Math.floor(z*2)+10031,668265263))>>>0)%9-4;
 const tint=(r:number,g:number,b:number):readonly[number,number,number]=>[r+noise,g+noise,b+noise];
 const roadX=w+69,north=-d-67,south=d+59;
 const far=ax>w+130||az>d+150;
 // Existing three-dimensional avenues continue seamlessly into the wider city.
 const dx=Math.min(Math.abs(x-roadX),Math.abs(x+roadX));
 const dz=Math.min(Math.abs(z-north),Math.abs(z-south));
 if(dx<4.5||dz<5) {
  const centre=dx<.15||dz<.15;
  return centre&&Math.floor((dx<dz?z:x)/5)%2===0?tint(175,177,156):tint(66,77,78);
 }
 if(!far) {
  const garden=(az>d+25&&az<d+50&&ax<w*.85)||(ax>w+28&&ax<w+36);
  if(garden)return tint(88,114,74);
  const seam=Math.abs(x%5)<.09||Math.abs(z%5)<.09;
  return seam?tint(122,133,125):tint(151,159,145);
 }
 const gx=((x+512)%64+64)%64,gz=((z+512)%64+64)%64;
 if(gx<4||gz<4||gx>60||gz>60) {
  const stripe=(Math.min(gx,64-gx)<.20&&Math.floor(z/5)%2===0)||(Math.min(gz,64-gz)<.20&&Math.floor(x/5)%2===0);
  return stripe?tint(172,175,153):tint(64,77,77);
 }
 if(gx<10||gz<10||gx>61||gz>61)return tint(143,151,138);
 const blockX=Math.floor((x+512)/64),blockZ=Math.floor((z+512)/64);
 const park=((blockX*7+blockZ*11)%9+9)%9===0;
 if(park)return Math.abs(gx-35)<2||Math.abs(gz-35)<2?tint(147,155,133):tint(70,105,66);
 // A few inexpensive distant rooftop footprints avoid a blank ground between 3D blocks.
 const lx=(gx-10)%23,lz=(gz-10)%23;
 if(lx>3&&lx<19&&lz>3&&lz<19){
  if(lx>17||lz>17)return tint(72,86,84);
  const tone=((blockX+blockZ)%3+3)%3;
  return tone===0?tint(114,111,98):tone===1?tint(96,113,115):tint(130,126,111);
 }
 return tint(99,117,93);
}
export function buildCityGroundPixels(width:number,depth:number,size=512,paddingX=260,paddingZ=300):Uint8Array {
 if(![width,depth].every(n=>Number.isFinite(n)&&n>=20)||!Number.isInteger(size)||size<16||size>1024||![paddingX,paddingZ].every(n=>Number.isFinite(n)&&n>=0))throw new RangeError('Invalid city ground map dimensions');
 const pixels=new Uint8Array(size*size*4);
 for(let py=0;py<size;py++)for(let px=0;px<size;px++){
  const x=(px/(size-1)-.5)*(width+paddingX),z=(.5-py/(size-1))*(depth+paddingZ);
  const color=cityGroundColor(x,z,width,depth),o=(py*size+px)*4;
  pixels[o]=color[0];pixels[o+1]=color[1];pixels[o+2]=color[2];pixels[o+3]=255;
 }
 return pixels;
}
