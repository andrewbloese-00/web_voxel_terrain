/**
 --------------------------------------------------------
    Created by Andrew Bloese on Jan 27, 2025 
 --------------------------------------------------------
  Utilizes multiple different octaved noise functions 
  in order to procedurally generate terrain from a given 
  client seed. 

  - Chunk Based Rendering: 8x8x8 chunks of voxels
  - Only visible/ chunk edge faces are rendererd 
    To-Do: 
    ======
    -> prevent rendering non-visible chunk borders. 
    -> implement frustum culling 
    -> decouple generation and rendering logic
*/

//threejs
import { 
    Box3, BufferAttribute, BufferGeometry, Clock, 
    Frustum, Matrix4, Mesh, PerspectiveCamera, 
    ShaderMaterial, Vector3
} from "three";

//noise utils
import { make2dNoise, n_shuffle_seed } from "../noise-util/open-simplex-noise-2d";
import { OctavedNoise2d } from "../noise-util/noise";

//encoder/decoder
import { RunLengthEncoder } from "../helpers/rle";
import { packFaceData } from "../helpers/voxel_pack";

//misc utilities
import { getTextureAtlas } from "../helpers/textureLoader";
import { sqDist, clamp } from "../helpers/math";

//game constants
import { 
    CHUNK_SIZE, VOXEL_SIZE, CHUNK_WORLD_SIZE,
    CHUNK_LENGTH, VOXEL_TYPES, FACE_DIRECTIONS
} from "./terrain_constants"

//shaders
import voxel_vert_shader from '../shaders/voxel.vert'
import voxel_frag_shader from '../shaders/voxel.frag'

type WorldConfig = { 
    seed:number, 
    equator_temp: number // 0 ≤ equator_temp ≤ 1
    temp_decay_coeff:number //scales the falloff of temperature from equator
    max_elevation: number // 0 ≤ y ≤ max_elevation
    world_size: number // 0 ≤ x,z ≤ world_size
    water_level: number //at or below this elevation is considered water on initial generation  
}

//"semantic" type names 
type ChunkKeyType = string 
type VoxelID = number; 

interface WorldGeneratorFunctions { 
    moisture: OctavedNoise2d,
    height: OctavedNoise2d,
    wackiness: OctavedNoise2d,
    temperature: (z:number)=>number
}


//an update function for updating uniforms, and the chunk's actual mesh (cached)
type ChunkMesh = {
    mesh: Mesh,
    update: ()=>void

}

//cache the visible faces, as well as the rle voxel data
type ChunkCacheItem = {
    enc: Uint16Array
    faces: Map<VoxelID,number[]>,
    n: number,
    is_empty: boolean
}

export class ChunkGenerator{ 
    #noises:WorldGeneratorFunctions
    #config:WorldConfig
    #c_cache:Map<ChunkKeyType,ChunkCacheItem> 
    #m_cache:Map<ChunkKeyType,ChunkMesh>

    #frustum:Frustum
    #projScreenMatrix:Matrix4
    
    static CLOCK = new Clock(true);

    constructor(config:WorldConfig){
        const hnoise = make2dNoise(config.seed)
        const mseed = n_shuffle_seed(config.seed,10)
        const wseed = n_shuffle_seed(mseed, 10) //seed for "wackiness" noise value
        const mnoise = make2dNoise(mseed)
        const wnoise = make2dNoise(wseed)
        
        const eq = config.world_size/2

        this.#config = config
        this.#noises = {
            moisture: new OctavedNoise2d(mnoise,1.0,200),
            height: new OctavedNoise2d(hnoise,1.2,400),
            wackiness: new OctavedNoise2d(wnoise,1,20),    
            temperature(z){
                const eq_dist = Math.abs(z-eq)
                return clamp(config.equator_temp - eq_dist*config.temp_decay_coeff, 0, 1)   
            }
        }
        this.#c_cache = new Map<ChunkKeyType,ChunkCacheItem>();
        this.#m_cache = new Map<ChunkKeyType,ChunkMesh>();
        this.#frustum = new Frustum()
        this.#projScreenMatrix = new Matrix4()
    }

    #determineGeneratedVoxel(genHeight:number,wackiness:number, worldPos:Vector3){
        //UNDERWATER -> pos.y < genHeight
        if(worldPos.y < this.#config.water_level){
            //top is water
            if(worldPos.y >= genHeight) return VOXEL_TYPES.WATER
            // 2 meter deep of sand
            if(worldPos.y + 2 >= genHeight) return VOXEL_TYPES.SAND
            // 2(sand) + 6(mud) = 8
            if(worldPos.y + 8 >= genHeight) return VOXEL_TYPES.MUD
            // 2(sand) + 6(mud) + 6(sandstone)
            if(worldPos.y + 14 >= genHeight ) return VOXEL_TYPES.SANDSTONE
            return VOXEL_TYPES.STONE
        }
        //empty voxel, return without determining biome
        if(worldPos.y > genHeight) return VOXEL_TYPES.AIR
        //assume these are both between 0..1 
        const moisture = this.#noises.moisture.eval(worldPos.x,worldPos.z)
        const temperature = this.#noises.temperature(worldPos.z)


        // DESERT -> dry and hot
        if(moisture <= .3 && temperature >= .7){
            // 3 sand , 4 sandstone, stone
            if(worldPos.y + 3 >= genHeight) return VOXEL_TYPES.SAND
            if(worldPos.y + 7 >= genHeight) return VOXEL_TYPES.SANDSTONE
            return VOXEL_TYPES.STONE
        }

        // TUNDRA -> dry and cold 
        if(moisture <=.4 && temperature <= .3){
            //1 snow, 5 packed dirt, stone
            if(worldPos.y + 1 >= genHeight) return VOXEL_TYPES.SNOW
            if(worldPos.y + 6 >= genHeight) return VOXEL_TYPES.PACKED_DIRT
            return VOXEL_TYPES.STONE; 
        }


        //super moist (ohhh yeahh ^o^)
        if(moisture > .7 && wackiness){
            //hot and wacky -> mushrooms
            if(wackiness > .7 && temperature > .7){
                //1 mycelium -> 6 dirt -> stone
                if(worldPos.y+1 >= genHeight) return VOXEL_TYPES.MYCELIUM
                if(worldPos.y + 7 >= genHeight) return VOXEL_TYPES.DIRT
                return VOXEL_TYPES.STONE
            }
            
            //jungle
            //1 grass | fertile dirt ->  6 dirt -> stone
            if(worldPos.y + 1 >= genHeight) return VOXEL_TYPES.GRASS
            if(worldPos.y + 3 >= genHeight ) return VOXEL_TYPES.FERTILE_DIRT
            if(worldPos.y + 7 >= genHeight) return VOXEL_TYPES.DIRT
            return VOXEL_TYPES.STONE

        }


        //default generation = grass -> 5 dirt -> stone
        if(worldPos.y + 1 >= genHeight) return VOXEL_TYPES.GRASS
        if(worldPos.y + 6 >= genHeight) return VOXEL_TYPES.DIRT
        return VOXEL_TYPES.STONE
    }

    #generateChunk(chunk_coords:Vector3){
        const world = new Vector3()
        const cacheKey = `${chunk_coords.x},${chunk_coords.y},${chunk_coords.z}`
   

        const c_cache_hit = this.#c_cache.get(cacheKey)
        if(c_cache_hit) return c_cache_hit


        const voxelData = new Uint8Array(CHUNK_LENGTH)
        //wackiness is per chunk 
        const chunk_wackiness_factor = this.#noises.wackiness.eval(chunk_coords.x/100,chunk_coords.z/100, 10);
        let chunk_exp = 1
        if(chunk_wackiness_factor < .2) //flatlands
            chunk_exp = 16
        else if(chunk_wackiness_factor < .4){
            chunk_exp = 8
        } else if(chunk_wackiness_factor < .6){
            chunk_exp = 2
        }
        else if (chunk_wackiness_factor > .8){
            chunk_exp = 0.5
        } else chunk_exp  = chunk_wackiness_factor

        //populate voxel data
        
        for(let x = 0; x < CHUNK_SIZE; x++){
            world.x = chunk_coords.x * CHUNK_WORLD_SIZE + x * VOXEL_SIZE
            for(let z = 0; z < CHUNK_SIZE; z++){
                world.z = chunk_coords.z * CHUNK_WORLD_SIZE + z * VOXEL_SIZE
                const e = Math.pow(this.#noises.height.eval(world.x,world.z), chunk_exp)
                const genHeight = e * this.#config.max_elevation; 
                for(let y = 0; y < CHUNK_SIZE; y++){
                    world.y = chunk_coords.y * CHUNK_WORLD_SIZE + y * VOXEL_SIZE
                    const voxel_type = this.#determineGeneratedVoxel(genHeight,chunk_wackiness_factor, world); 
                    const i = x + y*CHUNK_SIZE + z *CHUNK_SIZE*CHUNK_SIZE
                    voxelData[i] = voxel_type;
                }
            }
        }
        const encVoxels = RunLengthEncoder.encode(voxelData)

        
        
        //construct list of only visible faces
        const visible = new Map<VoxelID,number[]>
        const entry = { 
            enc: encVoxels,
            faces: visible,
            n: 0,
            is_empty: false
        }
        
        //empty chunk,  skip 
        if(encVoxels.length == 2 && encVoxels[1] === VOXEL_TYPES.AIR) {
            entry.is_empty = true; //flag empty 
            this.#c_cache.set(cacheKey,entry)
            return entry; 
        }
        

        


        let nidx = 0, sz = 0;
        for(let x = 0; x < CHUNK_SIZE; x++){
            for(let z = 0; z < CHUNK_SIZE; z++){
                for(let y = 0; y < CHUNK_SIZE; y++){
                    const idx = x + y * CHUNK_SIZE + z * CHUNK_SIZE*CHUNK_SIZE
                    if(!voxelData[idx]) continue //undefined or air block... skip that shit
                    for(let d = 0; d < FACE_DIRECTIONS.length;d++ ){
                        const [ox,oy,oz] = FACE_DIRECTIONS[d]
                        //neighbor voxel x,y,z
                        const [nx, ny, nz] = [x + ox , y + oy, z + oz] 
                        //only compute buffer index if not out of bounds... 
                        const oob = nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE
                        if(!oob) nidx = nx + ny * CHUNK_SIZE + nz *CHUNK_SIZE*CHUNK_SIZE;
                        //neighbor is outside of chunk or empty -> current face is visible
                        if(oob || voxelData[nidx]==VOXEL_TYPES.AIR || voxelData[nidx] == VOXEL_TYPES.WATER){
                            const packed_face = packFaceData(x,y,z,voxelData[idx],d);
                            const list = visible.get(voxelData[idx])
                            if(!list) visible.set(voxelData[idx], [packed_face])
                            else list.push(packed_face)
                            sz++
                        }
                    }
                }
            }
        }


        //cache the encoded voxels, # of faces, and the "packed" faces themselves
        entry.n = sz
        this.#c_cache.set(cacheKey,entry)
        
        return entry
    }
    
    async get_chunk(chunk_coords:Vector3){

        const cacheKey = `${chunk_coords.x},${chunk_coords.y},${chunk_coords.z}`

        //avoid rebuilding meshes if possible
        const meshCacheHit = this.#m_cache.get(cacheKey);
        if(meshCacheHit){
            return meshCacheHit
        }
        
        //avoid regenerating / recalculating visible blocks in a chunk if possible
        let num_faces:number = 0, faces:Map<VoxelID,number[]>;
        const chunkCacheHit = this.#c_cache.get(cacheKey);

        if(chunkCacheHit){
            num_faces = chunkCacheHit.n
            faces = chunkCacheHit.faces
        } else { 
            const chunk = this.#generateChunk(chunk_coords);
            num_faces = chunk.n
            faces = chunk.faces
        }

        
        //2 triangles per face and 3 vertices per triangle = x6
        const num_vertices = num_faces * 6; 

        const total_indices_per_face = 6; 

        const indices = new Uint16Array(num_faces * total_indices_per_face);
        
        const atlas = await getTextureAtlas()
        if(!atlas) throw new Error("failed to load atlas, cannot continue...")


        const uniforms = {
            u_chunk_size: {value: CHUNK_SIZE },
            u_voxel_size: { value: VOXEL_SIZE},
            u_chunk_indices: {value: chunk_coords.clone()},
            u_time: { value: ChunkGenerator.CLOCK.getElapsedTime()},
            textureAtlas: { value: atlas}
        }


        const packed_buffer = new Float32Array(num_vertices);
        const position_buffer = new Float32Array(num_vertices*3);//x,y,z for each
        const vert_id_buffer = new Float32Array(num_vertices);
        
        let idx = 0, iidx = 0
        for(const [_,instances] of faces){
            for(const packedPoint of instances){
                // unpackChunkCoords(packedPoint,faceView);//reuse 'face view' for packed data
                //
                /* face consists of...
                    A-----B 
                    |    /|
                    |   / |
                    |  *  | 
                    | /   |
                    |/    |
                    C-----D
                    NOTE: * is the packed point current position and is (VOXEL_SIZE/2) away from each face in all directions
                 */
                //make 4 'copies' to be passed as attribute, to be interpreted by shader
                //also 4 new entries to the vertices
                for(let i = 0; i < 4; i++){
                    position_buffer[3*(idx)]= 0
                    position_buffer[3*(idx)+1]= 0
                    position_buffer[3*(idx)+2]= 0
                    vert_id_buffer[idx] = i
                    packed_buffer[idx] = packedPoint
                    idx++
                   
                }
                const baseIndex = idx - 4;
                indices[iidx++] = baseIndex;
                indices[iidx++] = baseIndex + 1;
                indices[iidx++] = baseIndex + 2;
                indices[iidx++] = baseIndex + 1;
                indices[iidx++] = baseIndex + 3;
                indices[iidx++] = baseIndex + 2;
            }
        }
        const faceMaterial = new ShaderMaterial({
            vertexShader: voxel_vert_shader,
            fragmentShader: voxel_frag_shader,
            uniforms,
        })

        

        const geo = new BufferGeometry()
        const packed_attribute = new BufferAttribute(packed_buffer,1)
        const idAttribute = new BufferAttribute(vert_id_buffer, 1)
        const positionAttribute = new BufferAttribute(position_buffer,3)
        geo.setAttribute("position",positionAttribute)
        geo.setAttribute("packedData",packed_attribute)
        geo.setAttribute("vertexID", idAttribute);
        geo.setIndex(new BufferAttribute(indices,1))
        positionAttribute.needsUpdate = true
        const mesh = new Mesh(geo,faceMaterial)
        const update = () =>{
             uniforms.u_time.value = ChunkGenerator.CLOCK.getElapsedTime()
        }
        const chunkmesh:ChunkMesh = { 
            mesh, update
        }
        this.#m_cache.set(cacheKey,chunkmesh);

        return chunkmesh

    } 

    //!broken
    getVisibleChunksList(camera:PerspectiveCamera, renderRadius:number){
        const center_chunk_coords = new Vector3(
            Math.floor(camera.position.x/CHUNK_WORLD_SIZE),
            Math.floor(camera.position.y/CHUNK_WORLD_SIZE),
            Math.floor(camera.position.z/CHUNK_WORLD_SIZE),
        )

        this.#projScreenMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
        this.#frustum.setFromProjectionMatrix(this.#projScreenMatrix)
        
        const visible:Vector3[] = [center_chunk_coords] 
        const checked = new Set<string>();

        let currentRadius = renderRadius
            for(let x = -currentRadius; x <= currentRadius; x++){
                for(let z = -currentRadius;z <= currentRadius; z++){
                    for(let y = -currentRadius; y <= currentRadius; y++){
                        const currentPos = new Vector3(x,y,z).add(center_chunk_coords);
                        const key = `${currentPos.x},${currentPos.y},${currentPos.z}`
                        if(checked.has(key)){
                            continue; 
                        }
                        checked.add(key)
                        const chunkWorldStart = currentPos.clone().multiplyScalar(CHUNK_WORLD_SIZE);
                        const bounds = new Box3(
                            chunkWorldStart.clone(),
                            chunkWorldStart.clone().addScalar(CHUNK_WORLD_SIZE)
                        );
                        if(this.#frustum.intersectsBox(bounds)){
                            console.log(bounds)
                            visible.push(currentPos);
                        }
                    }
                }
            }
        return visible.sort((a,b)=>sqDist(center_chunk_coords,a) - sqDist(center_chunk_coords,b))
    }


}
