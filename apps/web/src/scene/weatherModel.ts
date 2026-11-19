export type SimulatedWeather = 'sunny' | 'overcast' | 'rain';
export const WEATHER_PRESETS = {
  sunny: { zenith:'#669fc4', horizon:'#e4ece9', ambient:1.25, sun:2.65, sunColor:'#fff3de', cloud:.12 },
  overcast: { zenith:'#8d9ba7', horizon:'#dce1df', ambient:1.65, sun:.85, sunColor:'#e7eef5', cloud:.55 },
  rain: { zenith:'#536674', horizon:'#acb9c1', ambient:1.50, sun:.55, sunColor:'#d1e0ec', cloud:.82 },
} as const;
/** Bounded deterministic rain only outside the store footprint; never changes store geometry. */
export function buildExteriorRain(width:number,depth:number,count=420):Float32Array {
  if(![width,depth].every(n=>Number.isFinite(n)&&n>0)||!Number.isInteger(count)||count<0||count>700) throw new RangeError('Invalid rain bounds or budget');
  const out=new Float32Array(count*6);
  for(let i=0;i<count;i++) {
    const a=((i*73)%997)/997,b=((i*193+31)%991)/991;
    const side=i%4;
    const x=side<2 ? (side===0?-1:1)*(width/2+3+a*23) : (a-.5)*(width+46);
    const z=side<2 ? (b-.5)*(depth+36) : (side===2?-1:1)*(depth/2+3+b*17);
    const y=1+((i*47)%127)/127*13;
    out.set([x,y,z,x,y+1.0,z],i*6);
  }
  return out;
}
