/** Original neutral window-wall atlas shared by distant building masses. */
export function buildCityFacadePixels(size=128):Uint8Array {
 const data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
  const u=x%16,v=y%16,window=u>3&&u<12&&v>3&&v<12;
  const c=window?(v<6?[137,162,171]:[90,121,136]):[235,233,220];
  const i=(y*size+x)*4;data[i]=c[0]!;data[i+1]=c[1]!;data[i+2]=c[2]!;data[i+3]=255;
 }
 return data;
}
export function hasCityFacade(id:string):boolean{return /fabric-block-.*(streetwall|corner)|city-far-side-[-\d]+$|city-far-south-\d+$/.test(id);}
