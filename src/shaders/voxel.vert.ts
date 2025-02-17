/*
--------------------------------------------------------
    Created by Andrew Bloese on Feb 7, 2025 
--------------------------------------------------------
 This vertex shader unpacks the data in its "packedData" 
 attribute along with its "vertexID" attribute in order to
 position voxel vertices, and determine the texture coords
 (to pass to fragment shader). 

 - hopefully i did this ok? 
*/

const src = `
uniform float u_time; 
uniform float u_voxel_size; 
uniform float u_chunk_size;
uniform vec3 u_chunk_indices;

attribute float vertexID; 
attribute float packedData;

varying float v_Type; 
varying float v_Direction;
varying vec2 v_TexCoord;

// Unpack the data into position, type, and direction
void unpackData(float packed, out vec3 position, out float type, out int direction) {
    float x = floor(mod(packed / pow(2.0, 20.0), 16.0));
    float y = floor(mod(packed / pow(2.0, 16.0), 16.0));
    float z = floor(mod(packed / pow(2.0, 12.0), 16.0));
    type = floor(mod(packed / pow(2.0, 4.0), 256.0));
    v_Direction = mod(packed, 8.0);
    direction = int(v_Direction);
    
    position = vec3(x, y, z);
}

vec2 getTextureCoordinates(float vertID) {
    // Match your vertex quad layout
    // WebGL UV coordinate system (0,0 at bottom-left)
    if(vertID == 0.0) return vec2(0.0, 1.0); // Bottom left
    if(vertID == 1.0) return vec2(1.0, 1.0); // Bottom right
    if(vertID == 2.0) return vec2(0.0, 0.0); // Top left
    if(vertID == 3.0) return vec2(1.0, 0.0); // Top right
    return vec2(0.0); // Fallback
}



vec3 applyWaterRipple(vec3 position, vec3 worldPos, float voxelType) {
    if (voxelType == 5.0) { // Water type
        // Only apply to top faces for better effect
        if (position.y > 0.0) {
            // Create waves using world position for variation
            float wave1 = sin(worldPos.x * 2.0 + u_time * 1.5) * 0.05;
            float wave2 = cos(worldPos.z * 2.0 + u_time * 2.0) * 0.06;
            
            // Apply vertical displacement
            position.y += wave1 + wave2;
            
            // Add subtle horizontal movement
            position.x += sin(u_time + worldPos.z) * 0.0;
            position.z += cos(u_time + worldPos.x) * 0.0;
        }
    }
    return position;
}


// Get the base quad vertices based on face direction
vec3 getFaceVertexPosition(int faceDirection, float vertID, float size) {
    vec3 pos = vec3(0.0);
    float halfSize = size * 0.5;
    
    // Create base quad vertices
    vec2 quadPos = vec2(0.0);
    if(vertID == 0.0) quadPos = vec2(halfSize, halfSize);    // Top right
    if(vertID == 1.0) quadPos = vec2(-halfSize, halfSize);   // Top left
    if(vertID == 2.0) quadPos = vec2(halfSize, -halfSize);   // Bottom right
    if(vertID == 3.0) quadPos = vec2(-halfSize, -halfSize);  // Bottom left

    switch(faceDirection) {
        case 0: // TOP [0,1,0]
            pos = vec3(quadPos.x, halfSize, -quadPos.y);
            break;
        
        case 1: // BOTTOM [0,-1,0]
            pos = vec3(-quadPos.x, -halfSize, -quadPos.y);
            break;
        
        case 2: // RIGHT [1,0,0]
            pos = vec3(halfSize, quadPos.y, -quadPos.x);
            break;
        
        case 3: // LEFT [-1,0,0]
            pos = vec3(-halfSize, quadPos.y, quadPos.x);
            break;
        
        case 4: // FRONT [0,0,1]
            pos = vec3(quadPos.x, quadPos.y, halfSize);
            break;
        
        case 5: // BACK [0,0,-1]
            pos = vec3(-quadPos.x, quadPos.y, -halfSize);
            break;
    }
    
    return pos;
}

void main() {
    vec3 voxelPosition;
    float voxelType;
    int faceDirection;
    
    unpackData(packedData, voxelPosition, voxelType, faceDirection);
    v_Type = voxelType;
    v_TexCoord = getTextureCoordinates(vertexID); 

    // Get the vertex position for this face
    vec3 vertexOffset = getFaceVertexPosition(faceDirection, vertexID, u_voxel_size);
    
    // Calculate final position
    float chunk_size = u_chunk_size * u_voxel_size;
    vec3 chunk_offset = u_chunk_indices * chunk_size;
    vec3 local_offset = voxelPosition * u_voxel_size;
    vec3 wp = chunk_offset + local_offset; 
    vertexOffset = applyWaterRipple(vertexOffset,wp,voxelType);
    vec3 final_position = chunk_offset + local_offset + vertexOffset;

    

    gl_Position = projectionMatrix * modelViewMatrix * vec4(final_position, 1.0);
}
`
export default src