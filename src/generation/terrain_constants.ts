export const CHUNK_SIZE = 8 // 8 x 8 x 8 chunks
export const VOXEL_SIZE = 1 //in meters
export const CHUNK_WORLD_SIZE = CHUNK_SIZE*VOXEL_SIZE; //length of a side of a chunk in world units (meters)
export const CHUNK_LENGTH = CHUNK_SIZE**3 // the size of a "flattened" chunk array

export const VOXEL_TYPES = { 
    AIR: 0 ,
    GRASS: 1, 
    DIRT: 2,
    PACKED_DIRT:3,
    SAND:4,
    WATER: 5, 
    STONE: 6, 
    MUD: 7,
    SANDSTONE: 8,
    SNOW: 9, 
    MYCELIUM: 10,
    FERTILE_DIRT: 11,
    GNEISS: 12, 
    MARBLE: 13,
    GABBRO: 14,
    ANDESITE: 15,
    BASALT: 17,
    LAVA: 18, 
    RED_SAND: 19,
    RED_SANDSTONE: 20,
    __END__: 20
}
export const FACE_DIRECTIONS = [
    [0,1,0],//top
    [0,-1,0],//bottom
    [1,0,0], //right
    [-1,0,0], //left
    [0,0,1], //front
    [0,0,-1], //back
]