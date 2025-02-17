/*---
  Created by Andrew Bloese
  Jan 27, 2025
  ---
  created to enable run length encoding/decoding of voxel_data (int in range 0-255)

 */

export const RunLengthEncoder = {
    encode(voxel_data:Uint8Array){

        let count = 1, current = voxel_data[0], n_pairs  = 0 
        for(let i = 1; i < voxel_data.length; i++){
          if(voxel_data[i] == current) count++
          else {
              n_pairs++;
              current = voxel_data[i]
              count = 1
          }
        }
        n_pairs++
  
        const e = new Uint16Array(n_pairs*2);
        let idx = 0; 
        current = voxel_data[0];
        count = 1; 
  
        for(let i = 1; i < voxel_data.length; i++){
            if(voxel_data[i] == current) count++
            else { 
              e[idx++] = count
              e[idx++] = current
              current = voxel_data[i]
              count = 1
            }
        }
        e[idx++] = count
        e[idx++] = current
  

        return e
        
  
    },
    decode(e:Uint16Array,sz:number){
        const data = new Uint8Array(sz)
        let p = 0
        for(let i = 0; i < e.length; i+=2){ // for [count,type] of encoded
            for(let j = 0; j < e[i]; j++){
                data[p++] = e[i+1]
            }
        }
        return data
    }


}