import { expect,it } from 'vitest';
import { buildExteriorRain,WEATHER_PRESETS } from './weatherModel';
it('keeps every rain segment outside the open cutaway interior',()=>{
  for(const [w,d] of [[80,50],[130,100]]) {
    const rain=buildExteriorRain(w!,d!);
    expect(rain.length).toBe(420*6);
    expect(rain).toEqual(buildExteriorRain(w!,d!));
    for(let i=0;i<rain.length;i+=6) {
      expect(Math.abs(rain[i]!)>=w!/2+2.9||Math.abs(rain[i+2]!)>=d!/2+2.9).toBe(true);
      expect(rain[i+3]).toBe(rain[i]);
      expect(rain[i+5]).toBe(rain[i+2]);
    }
  }
});
it('bounds the particle budget and keeps overcast/rain interiors readable',()=>{
  expect(()=>buildExteriorRain(80,50,701)).toThrow();
  expect(()=>buildExteriorRain(0,50)).toThrow();
  expect(WEATHER_PRESETS.rain.ambient).toBeGreaterThanOrEqual(WEATHER_PRESETS.sunny.ambient);
  expect(WEATHER_PRESETS.rain.sun).toBeLessThan(WEATHER_PRESETS.sunny.sun);
});
