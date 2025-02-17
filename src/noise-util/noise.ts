/*---
  Created by Andrew Bloese
  Jan 27, 2025
  ---
  custom implementation of 2d octaved noise using 2d noise derived from: 
   -> https://github.com/joshforisha/open-simplex-noise-js
  
  memoizes evaluations of the noise function on each call in attempt to skip calculations later. 
  
*/
import { NoiseFn2d, make2dNoise } from "./open-simplex-noise-2d"

export class OctavedNoise2d { 
    #evals :Map<string,number>
    wavelength:number
    amp:number
    noise:NoiseFn2d

    constructor(noiseFn:NoiseFn2d,amp:number,wavelength:number){
      this.wavelength = wavelength
      this.amp = amp
      this.noise = noiseFn
      this.#evals = new Map(); 
    } 
    eval(a:number,b:number,n_octaves=3){
      const key = `${a},${b},${n_octaves}` 
      const cache_hit = this.#evals.get(key)
      if(cache_hit) return cache_hit; 
      let oct = 1, res = 0, sum_amp = 0
      for(let o = 0; o < n_octaves; o++){
        let amp_local = (1/oct)*this.amp
        sum_amp += amp_local
        res += amp_local * this.noise(oct*(a/this.wavelength), oct * (b/this.wavelength))
        oct *= 2
      }
      const ans = res/sum_amp
      this.#evals.set(key,ans)
      return ans
    }
}


export function makeOctavedNoise2d(seed:number,wavelength:number,amp:number){
    const n2d = make2dNoise(seed,true);//normalized 2d noise
    return new OctavedNoise2d(n2d,amp,wavelength);
}