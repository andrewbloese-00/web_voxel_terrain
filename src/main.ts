import { Vector3 } from "three";
import { ChunkGenerator } from "./generation/world";

import { initWGLScene } from "./helpers/webGLScene";

const FPS = 144;
const FRAME_DELAY = 1000/FPS

//init the scene
const { scene, camera, renderer, d_controls } = initWGLScene()
document.body.appendChild(renderer.domElement)

camera.position.set(50,80,100)
camera.lookAt(new Vector3(60,75,100,))


//create a generator
const generator = new ChunkGenerator({
  seed: Date.now(),
  equator_temp: 1,
  temp_decay_coeff: .1,
  max_elevation: 255,
  world_size: 1000,
  water_level: 40
})




//really shitty way of adding shader uniform updates
let updatePipeline:(()=>void)[] = [] 
let doUpdate = () => {
  for(const update of updatePipeline){
    update()
  } 
  d_controls.update()
}



function animate(){
  renderer.render(scene,camera);
  doUpdate();
  setTimeout(()=>{
    requestAnimationFrame(animate)
  },FRAME_DELAY)
}
requestAnimationFrame(animate)

const sleep = (ms:number) => new Promise(resolve=>setTimeout(resolve,ms))

async function generate(n=20){
  const center = camera.position.clone()
  center.x = Math.floor(center.x/8)
  center.y = Math.floor(center.y/8)
  center.z = Math.floor(center.z/8)
  let half = n/2
  const current = center.clone();
  for(let x = -half; x <= half; x++){
    for(let z = -half; z <= half; z++){
      for(let y = -n; y <= n; y++){
        current.copy(center).add(new Vector3(x,y,z))
        const chunk = await generator.get_chunk(current)
        scene.add(chunk.mesh)
        updatePipeline.push(chunk.update)
        if(x == 0 && z == 0 && y == n){
          camera.position.copy(current.multiplyScalar(8))
        }
      }
      await sleep(0.1)
  
    }
    
  }


  
}

generate(20)

