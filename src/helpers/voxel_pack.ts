/* Packing Strategy
=====================
FIELD   |   Bits
 x      |     4
 y      |     4
 z      |     4
 type   |     8
 dir    |     3

 * fits in uint32 or float32
*/
/**
 * 
 * @param x the local x [0..15] of the voxel center
 * @param y the local y [0..15] of the voxel center
 * @param z the local z [0..15] of the voxel center
 * @param type the voxel type [0..255] (8 bit)
 * @param direction the direction the voxel is facing [0..5] => game constant "FACE_DIRECTIONS.length"
 * @returns the bit packed value
 */
export function packFaceData(x:number,y:number,z:number,type:number, direction:number){
    const packed = (x << 20) | (y << 16) | (z << 12) | (type<<4) | (direction&0b111)
    return packed
}

export type UnpackedFace = { x: number, y:number, z:number, type: number, direction: number}

/**
 * 
 * @param packed some 32 bit int or float
 * @param container the location to unpack the values to
 * @example ```typescript
    const faceView:UnpackedFace = { x: 0, y:0, z:0, type: 0, direction: 0}
    unpackFaceData(packedValue,faceView);
    console.log(faceView); 
 * ```
 */
export function unpackFaceData(packed:number,container:UnpackedFace){
    container.x = (packed >> 20) & 0b1111
    container.y = (packed >> 16) & 0b1111
    container.z = (packed >> 12) & 0b1111
    container.type = (packed>>4) & 0xFF
    container.direction = packed & 0b111
}


