/** Synthetic two-lane circulating traffic; no pedestrian or junction right-of-way solver. */
export function trafficPose(width:number,depth:number,time:number,index:number,lane:0|1) {
  if(![width,depth,time,index].every(Number.isFinite)||width<20||depth<20||time<0||index<0||index>=8)throw new RangeError('Invalid traffic input');
  const x=width/2+7+(lane===0?-1.6:1.6), north=-depth/2-8+(lane===0?1.6:-1.6),south=depth/2+14+(lane===0?-1.6:1.6);
  const a=2*x,b=south-north,length=2*(a+b);
  const distance=(time*5+index*length/8)%length;
  const s=lane===0?distance:(length-distance)%length;
  const flip=lane===0?0:Math.PI;
  if(s<a)return {x:-x+s,z:north,yaw:Math.PI/2+flip,length};
  if(s<a+b)return {x,z:north+s-a,yaw:flip,length};
  if(s<2*a+b)return {x:x-(s-a-b),z:south,yaw:-Math.PI/2+flip,length};
  return {x:-x,z:south-(s-2*a-b),yaw:Math.PI+flip,length};
}
