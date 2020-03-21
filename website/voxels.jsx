var React = require("react")
var ReactDOM = require("react-dom")

import Stats from "stats.js"

import * as THREE from 'three';

import {LightTheme, BaseProvider, styled} from 'baseui';
const THEME = LightTheme

class Voxels extends React.Component {
  constructor(props) {
    super(props)

    this.containerRef = React.createRef()
    this.canvasRef = React.createRef()
    this.state = {}
  }

  componentDidMount() {
    console.log("Voxel component mounted")

    // FPS counter
    var stats = new Stats();
    stats.showPanel(0);
    this.containerRef.current.appendChild(stats.dom)

    // Camera and scene instantiation
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera( 75, 1, 0.1, 1000 );

    //Block manager
    this.blockManager = new BlockScene(null)
    this.scene.add(this.blockManager.sceneGroup)

    // Controls
    this.controls = new FlyControls(this.camera, this.canvasRef.current)

    // var context = this.canvasRef.current.getContext('webgl2', {alpha: false});
    var context = this.canvasRef.current.getContext('webgl', {alpha: false});
    this.renderer = new THREE.WebGLRenderer({canvas: this.canvasRef.current, antialias: false, context});
    window.addEventListener("resize", () => this.resizeCanvasAndCamera())
    this.resizeCanvasAndCamera()
    // Keep at half-res
    // this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene.background = new THREE.Color(0xffffff);


    // var geometry = new THREE.BoxGeometry();
    // var material = new THREE.MeshStandardMaterial({color: 0x00ff00});
    // var cube = new THREE.Mesh(geometry, material);
    // this.scene.add(cube);
    var directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
    directionalLight.castShadow = true
    var ambientLight = new THREE.AmbientLight(0x404040, 1)
    this.scene.add(directionalLight)
    this.scene.add(ambientLight)

    var geometry = new THREE.PlaneGeometry(100, 100);
    var material = new THREE.MeshBasicMaterial( {color: 0xf9f9f9, side: THREE.DoubleSide} );
    var plane = new THREE.Mesh( geometry, material );
    plane.rotation.x = Math.PI / 2.0
    plane.position.y = -0.5
    this.scene.add( plane );

    var animate = (lastTime => {
      stats.begin()
      // cube.rotation.x += 0.01
      // cube.rotation.y += 0.01
      this.renderer.render(this.scene, this.camera);
      this.controls.externalTick(1/60)
      stats.end()

      requestAnimationFrame(animate)
    })
    requestAnimationFrame(animate)
    this.camera.position.z = 5

  }

  resizeCanvasAndCamera() {
    const { height, width} = this.canvasRef.current.getBoundingClientRect();
    this.renderer.setSize(width, height, false)

    // If want constant size objects across resizing
    // const startingFOV = 75
    // const startingHeight = 600
    // var tanFOV = Math.tan(((Math.PI/180) * startingFOV/2 ));
    // this.camera.fov = (360/Math.PI) * Math.atan(tanFOV*(height/startingHeight));

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

  }

  render() {
    return (
      <div style={{width: "100%", height:"100%"}}>
        <div style={{display: "flex", flexDirection: "row", height: "100%", padding: THEME.sizing.scale1000, boxSizing: "border-box"}}>
          <div ref={this.containerRef} style={{flexGrow: "1", display: "flex", flexDirection: "column"}}>
            <div style={{boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", overflow: "hidden", flexGrow: "1"}}>
              <canvas ref={this.canvasRef} style={{height: "100%", width: "100%"}}/>
            </div>
          </div>
          <div style={{boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", cursor: "pointer", padding: THEME.sizing.scale600, marginLeft: THEME.sizing.scale1000}}>
            hi i am a big margin
            {this.state.fps}
          </div>
        </div>
      </div>
    )
  }
}

// Handles updating block state array
// Handles block state array <=> THREE.js group syncing
class BlockScene  {
  constructor(blocks) {
    this.sceneGroup = new THREE.Group()
    const size = 16

    // If perf becomes issue, switch to tf.js etc
    if (!blocks) {
      this.blocks = this.empty3Darray(size, size, size)
      console.log(this.blocks)
      this.blocks[8][0][8] = 1
      this.blocks[8][1][8] = 1
      this.blocks[0][0][0] = 1
    }
    else {
      this.blocks = blocks
    }

    this.recreateSceneFromBlocks()
  }

  empty3Darray(size1, size2, size3) {
    var array = new Array()
    for (var i = 0; i<size1; i++) {
      array[i] = new Array()
      for (var j = 0; j<size2; j++){
        array[i][j] = new Array()
        for (var k = 0; k<size3; k++) {
          array[i][j][k] = Math.floor(Math.random()*2)
          if (j == 0) {
            array[i][j][k] = 1
          }
        }
      }
    }
    return array
  }

  iterator3D(array, func) {
    for (var i = 0; i<array.length; i++) {
      for (var j = 0; j<array[0].length; j++){
        for (var k = 0; k<array[0][0].length; k++) {
          func(i, j, k, array[i][j][k])
        }
      }
    }
  }

  recreateSceneFromBlocks() {
    this.iterator3D(this.blocks, (x, y, z, val) => {
        if (!(val == 0)) {
          this.addOrRemoveBlock(x, y, z, true, 1)
        }
    })
  }

  addOrRemoveBlock(x, y, z, isAdd, blockValue) {
    var geometry = new THREE.BoxGeometry();
    var material = new THREE.MeshStandardMaterial({color: 0x00ff00});
    var cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, y, z)
    this.sceneGroup.add(cube)

  }



}

class FlyControls {

  constructor(camera, domElement) {
    this.camera = camera
    this.domElement = domElement


    window.addEventListener("keydown", e => {
      this.updateKeystates(e.key, true)
      e.key == "e" && this.toggleMouseCapture()
    })
    window.addEventListener("keyup", e => {
      this.updateKeystates(e.key, false)
    })
    domElement.addEventListener("mousedown", e => {
      this.domElement.requestPointerLock()
    })
    document.addEventListener('pointerlockchange', () => {
      if (!(document.pointerLockElement == this.domElement)) {
        this.capturingMouseMovement = false
      } else {
        this.capturingMouseMovement = true
      }
    });
    domElement.addEventListener("mouseup", e => {
    })
    domElement.addEventListener("mousemove", e => this.capturingMouseMovement && this.updateMouseBuffer(e.movementX, e.movementY))


    this.keyState = {}
    this.mouseMoveBuffer = {x: 0, y: 0}
    this.captureMouseMovement = false

    // Configuration
    this.toggleMouseCaptureKey = "e"
    this.maxVelocity = 0.2 // in units/seconds
    this.timeToReachMaxSpeed = 0.6 // in seconds
    this.timeToReachZeroSpeed = 0.2 // in seconds
    this.velocity = new THREE.Vector3(0, 0, 0)
    this.rotationSensitivty = 0.003 // in radians per (pixel of mouse movement)

  }

  updateMouseBuffer(movementX, movementY) {
    this.mouseMoveBuffer.x += movementX
    this.mouseMoveBuffer.y += movementY
  }

  updateKeystates(key, isDown) {
    key = key.toLowerCase() // possible to have keyUp for "a" and then keyDown for "A" if shift involved.
    if (isDown) {
      this.keyState[key] = true
    } else {
      delete this.keyState[key]
    }
  }

  toggleMouseCapture() {
    this.capturingMouseMovement = !this.capturingMouseMovement
    this.capturingMouseMovement ? this.domElement.requestPointerLock() : document.exitPointerLock()
  }

  externalTick(timeDelta) {
    var cameraDirection = new THREE.Vector3()
    this.camera.getWorldDirection(cameraDirection)
    var forceVector = new THREE.Vector3(0, 0, 0)

    if ("w" in this.keyState) {
      forceVector.add(cameraDirection)
    } if ("s" in this.keyState) {
      forceVector.add(cameraDirection.clone().negate())
    } if ("a" in this.keyState) {
      forceVector.add((new THREE.Vector3(0, 1, 0)).cross(cameraDirection))
    } if ("d" in this.keyState) {
      forceVector.add((new THREE.Vector3(0, 1, 0)).cross(cameraDirection).negate())
    } if (" " in this.keyState) {
      forceVector.add(new THREE.Vector3(0, 1, 0))
    } if ("shift" in this.keyState) {
      forceVector.add(new THREE.Vector3(0, -1, 0))
    }

    const acceleration = this.maxVelocity * (timeDelta/this.timeToReachMaxSpeed)
    const deceleration = this.maxVelocity * (timeDelta/this.timeToReachZeroSpeed)
    forceVector.multiplyScalar(acceleration)
    // don't apply decel force that will flip velocity sign
    var decelerationForce = this.velocity.clone().normalize().negate().multiplyScalar(Math.min(deceleration, this.velocity.length()))

    // Have constant deceleration force when no input.
    var haveMoveInput = !forceVector.equals(new THREE.Vector3(0, 0, 0))
    if (haveMoveInput) {
      forceVector.sub(decelerationForce)
    }
    forceVector.add(decelerationForce)

    this.velocity.add(forceVector)
    this.velocity.clampLength(0, this.maxVelocity) // convenient
    this.camera.position.add(this.velocity)

    // Keep in mind that the direction of the camera will change
    this.camera.rotateOnWorldAxis((new THREE.Vector3(0, 1, 0)).cross(cameraDirection).normalize(), this.rotationSensitivty * this.mouseMoveBuffer.y)
    this.camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -this.rotationSensitivty * this.mouseMoveBuffer.x)
    // this.camera.quaternion.setFromAxisAngle(cameraDirection, 0)
    this.mouseMoveBuffer = {x: 0, y: 0}
  }

}

module.exports = Voxels
