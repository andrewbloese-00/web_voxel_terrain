import { Vector3 } from "three"

export const sqDist = (u:Vector3,v:Vector3) => {
    const dx = u.x - v.x
    const dy = u.y - v.y
    const dz = u.z - v.z
    return dx * dx + dy * dy + dz * dz
} 


export const clamp = (x:number,min:number,max:number) => {
    if(x < min) return min;
    if(x > max) return max
    return x
}


