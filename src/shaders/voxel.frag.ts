/*
---------------------------------------------------------
    Created by Andrew Bloese on Feb 13, 2025 
---------------------------------------------------------
 This fragment shader utilizes textures found in the file
 './textures.png'  (a 512x512 texture atlas) to properly
 color in voxel faces. 
 
*/



const src = `
uniform vec3 chunk_indices;
uniform float u_time;
uniform sampler2D textureAtlas;

varying vec2 v_TexCoord;
varying float v_Direction;
varying float v_Type;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// Atlas constants based on the actual texture layout
const float ATLAS_WIDTH = 512.0;
const float ATLAS_HEIGHT = 512.0;
const float TILE_SIZE = 16.0;        // Base tile size
const float BORDER_SIZE = 1.0;       // Border size in pixels
const float TOTAL_TILE_SIZE = 17.0;  // Including border (16 + 1)
const float TILES_PER_ROW = 30.0;    // Accounting for borders (512/17 ≈ 30)
const float TOTAL_ROWS = 30.0;

// UV safety margin to stay away from borders
const float SAFE_MARGIN = 0.002; // Adjusted margin to avoid borders

vec2 getVoxelUV(float voxelType, float faceIndex) {
    // Calculate tile index based on type and face
    float tileIdx = (voxelType - 1.0) * 6.0 + faceIndex;
    
    // Calculate row and column in atlas
    float row = floor(tileIdx / TILES_PER_ROW);
    float col = mod(tileIdx, TILES_PER_ROW);
    
    // Calculate base UV position
    vec2 baseUV = vec2(
        (col * TOTAL_TILE_SIZE + BORDER_SIZE) / ATLAS_WIDTH,
        1.0 - ((row * TOTAL_TILE_SIZE + TOTAL_TILE_SIZE - BORDER_SIZE) / ATLAS_HEIGHT)
    );
    
    return baseUV;
}

void main() {
    // Get the base UV for current tile
    vec2 tileBaseUV = getVoxelUV(v_Type, v_Direction);
    
    


    
    // Calculate the safe UV range within the tile
    vec2 safeTileSize = vec2(
        (TILE_SIZE - 2.0 * BORDER_SIZE) / ATLAS_WIDTH,
        (TILE_SIZE - 2.0 * BORDER_SIZE) / ATLAS_HEIGHT
    );
    
    // Scale and offset UVs to stay within safe area
    vec2 withinTileUV = vec2(
        v_TexCoord.x * safeTileSize.x + SAFE_MARGIN,
        v_TexCoord.y * safeTileSize.y + SAFE_MARGIN
    );
    
    // Combine base tile position with position within tile
    vec2 finalUV = tileBaseUV + withinTileUV;
    



    // Sample texture
    vec4 color = texture2D(textureAtlas, finalUV);
    
    // apply water effect
    if(v_Type == 5.0) {
        color.a = 0.5;
    }


    // Add directional shadows
    float shadowFactor = max(0.5, dot(normalize(vec3(v_Direction, 0.5, 1.0)), vec3(0.0, 1.0, 1.0)));
    color.rgb *= shadowFactor;
    
   


    gl_FragColor = color;
    
    // Debug output options (commented out)
    // gl_FragColor = vec4(finalUV, 0.0, 1.0);
    // gl_FragColor = vec4(tileBaseUV, 0.0, 1.0);
    // gl_FragColor = vec4(withinTileUV, 0.0, 1.0);
    // gl_FragColor = vec4(v_Type/30.0, v_Direction/6.0, 0.0, 1.0);
}
`
export default src