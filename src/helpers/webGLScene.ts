import { Scene, WebGLRenderer, PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'

const FOV = 75
const ASPECT = 1
const NEAR = 0.01
const FAR = 2000

export function initWGLScene(){
    const camera = new PerspectiveCamera(FOV,ASPECT, NEAR,FAR)
    const renderer = new WebGLRenderer()
    const scene = new Scene()
    
    //!Orbit Controls, DEBUG ONLY
    const d_controls = new OrbitControls(camera,renderer.domElement)
    

    function _update_size(){
        renderer.setSize(window.innerWidth,window.innerHeight)
        camera.updateProjectionMatrix()
        d_controls.update()
    }

    _update_size()
    window.addEventListener("resize",_update_size)
    
    function cleanup(){
        window.removeEventListener("resize",_update_size)
    }

    return { 
        scene, camera, renderer, cleanup,
        d_controls
    }

}