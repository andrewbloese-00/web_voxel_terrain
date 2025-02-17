

import { NearestFilter, Texture, TextureLoader } from "three";

import atlasPath from "../shaders/textures.png"

let atlas:Texture|undefined; 
export async function getTextureAtlas(){
    if(atlas) return atlas
    try {
        const loader = new TextureLoader();
        atlas = await loader.loadAsync(atlasPath)
        atlas.magFilter = NearestFilter;
        atlas.minFilter = NearestFilter;
        atlas.generateMipmaps = false; 
        console.log(atlas)
        return atlas

        
    } catch (error) {
        console.error("failed to load textures...\n",error)
        return null;
    }

    
}


