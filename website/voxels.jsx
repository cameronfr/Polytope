//Sphere optimization possible todo: https://medium.com/@calebleak/raymarching-voxel-rendering-58018201d9d6


var React = require("react")
var ReactDOM = require("react-dom")

import Stats from "stats.js"

import * as THREE from 'three';
import Regl from "regl"
import ndarray from "ndarray"
import mat4 from "gl-mat4"


import {LightTheme, BaseProvider, styled} from 'baseui';
const THEME = LightTheme

class Voxels extends React.Component {
  constructor(props) {
    super(props)
    this.canvasRef = React.createRef()
    this.containerRef = React.createRef()
  }

  componentDidMount() {
    var stats = new Stats();
    stats.showPanel(0);
    this.containerRef.current.appendChild(stats.dom)

    // Initialize blocks
    var randomColor = require('randomcolor')
    const worldSize = 16 //# blocks makes no diff when staring off into void
    this.blocks = ndarray(new Uint8Array(4*worldSize**3), [worldSize, worldSize, worldSize, 4])
    for ( let i =0; i < worldSize; i++) {
      for(var j=0; j < worldSize; j++) {
        for(var k=0; k < worldSize; k++) {
          this.blocks.set(i, j, k, 3, 0)
          // if (j == 0) {
          //   this.blocks.set(i, j, k, 3, 1)
          // }
          this.blocks.set(i, j, k, 3, Math.floor(Math.random()*1.02))
          // this.blocks.set(i, j, k, 3, 1)
          let color = randomColor({format:"rgbArray"})
          this.blocks.set(i, j, k, 0, color[0])
          this.blocks.set(i, j, k, 1, color[1])
          this.blocks.set(i, j, k, 2, color[2])
        }
      }
    }

    this.camera = new THREE.PerspectiveCamera(75, 1.0, 0.1, 1000)
    this.controls = new FlyControls(this.camera, this.canvasRef.current, this.blocks)
    this.resizeCanvasAndCamera()
    window.addEventListener("resize", () => this.resizeCanvasAndCamera())
    this.regl = Regl({
      canvas: this.canvasRef.current,
      extensions: ["OES_texture_float", 'EXT_shader_texture_lod', "OES_standard_derivatives"],
      onDone: function (err, regl) {
        if (err) {
          console.log(err)
          return
        }
      }

    })


    // var image = new Image()
    // image.src = 'https://i.imgur.com/0B6nUmB.jpg'
    // image.crossOrigin = "";
    // image.onload = () => {imageTexture(image)}
    var imageTexture = this.regl.texture()

    var invViewMatrix = ({viewportWidth, viewportHeight}) => {
      // view matrix is this.camera.matrixWorldInverse
      return this.camera.matrixWorld.elements
    }

    // gl-mat4 wasn't getting an inverse matrix (mb bcz NaN in perspective matrix?)
    var invProjectionMatrix = ({viewportWidth, viewportHeight}) => {
      return this.camera.projectionMatrixInverse.elements
    }
    // console.log(this.camera.projectionMatrixInverse)
    // console.log((new THREE.Vector4(0.1, 0.1, 0, 1)).applyMatrix4(this.camera.projectionMatrixInverse))

    const drawTriangle = this.regl({
      frag: `
        #extension GL_EXT_shader_texture_lod : enable
        #extension GL_OES_standard_derivatives : enable

        //precision mediump float;
        precision highp float;
        uniform vec4 color;
        uniform sampler2D blocks;
        uniform sampler2D imageTexture;
        uniform vec2 viewportSize;
        uniform mat4 invProjection;
        uniform mat4 invView;

        // robobo1221
        vec3 getSky(vec2 uv){
            float atmosphere = sqrt(1.0-uv.y);
            vec3 skyColor = vec3(0.2,0.4,0.8);

            float scatter = pow(0.2,1.0 / 15.0);
            scatter = 1.0 - clamp(scatter,0.8,1.0);

            vec3 scatterColor = mix(vec3(1.0),vec3(1.0,0.3,0.0) * 1.5,scatter);
            return mix(skyColor,vec3(scatterColor),atmosphere / 1.3);
        }

        float maxOf(vec3 vec) {
          return max(vec.x, max(vec.y, vec.z));
        }

        vec2 twoNonZero(vec3 vec) {
          // not a fan of all these epsilons but couldn't find other way
          const float eps = 0.001;
          if (vec[0] <= eps) {
            return vec2(vec[1], vec[2]);
          } else if (vec[1] <= eps) {
            return vec2(vec[0], vec[2]);
          } else if (vec[2] <= eps) {
            return vec2(vec[0], vec[1]);
          }
          return vec2(0,0);
        }

        void main() {
          vec2 scaledScreenCoord = 2.0 * ((gl_FragCoord.xy / viewportSize.xy) - 0.5); // -1 to 1
          mat4 inverseViewProjection = invView * invProjection;
          vec4 unscaledWorldCoords = inverseViewProjection * vec4(scaledScreenCoord, 0, 1);
          vec3 worldCoords = unscaledWorldCoords.xyz / unscaledWorldCoords.w;
          vec3 cameraPos = (invView * vec4(0, 0, 0, 1)).xyz;

          vec3 rayDir = normalize(worldCoords - cameraPos);
          const vec3 lightDir = normalize(vec3(1, -1, 1));

          const float eps = 0.0001;
          const float worldSize = ${worldSize.toFixed(1)};
          const float maxDist = 30.0;
          float t = 0.0;
          // while loops not allowed in Webgl 1 :/
          for(int i=0; i<50; i++) {

            vec3 rayPos = cameraPos + rayDir * t;

            if (clamp(rayPos, 0.0, float(worldSize) - 0.0000000001) == rayPos) {
              vec3 edge = vec3(floor(rayPos.x), floor(rayPos.y), floor(rayPos.z));
              vec2 blockIdxs = vec2(edge.x,edge.y*worldSize + edge.z);
              vec4 blockValue = texture2DLodEXT(blocks, blockIdxs/vec2(worldSize, worldSize*worldSize), 0.0);

              if (blockValue.a > 0.0) {
                vec3 hitDists = rayPos - (edge + 0.5);
                vec3 hitNorm = vec3(ivec3(hitDists / maxOf(abs(hitDists))));

                vec3 lightReflectionRay = lightDir - 2.0*dot(lightDir, hitNorm)*hitNorm;
                float reflectRayCosSim = dot(-rayDir, lightReflectionRay);
                float rayNormCosSim = dot(-rayDir, hitNorm);

                vec2 textureCoords = twoNonZero((1.0 - hitNorm) * (hitDists + 0.5));

                if (length(hitDists) > 0.8) {
                  gl_FragColor = vec4(0, 0, 0, 1);
                } else {
                  if (dot(hitNorm, -lightDir) < 0.0) {
                    reflectRayCosSim = 0.0;
                  }
                  vec3 colorMix  = (0.3*reflectRayCosSim + 0.6*rayNormCosSim + 0.5) * blockValue.xyz;
                  gl_FragColor = vec4(colorMix, 1.0);
                  // gl_FragColor = vec4(textureCoords, 0.0, 1.0);
                  // gl_FragColor = texture2D(imageTexture, textureCoords);
                }
                return;
              }
            }

            // round down if negative rayDir
            // round up if positive rayDir
            // need to get distance in direction of ray so sign matters
            vec3 distanceToPlanes = step(vec3(0, 0, 0), rayDir)*(1.0 - fract(rayPos)) + (1.0 - step(vec3(0, 0, 0), rayDir))*(fract(rayPos));
            vec3 tDeltasToPlanes = distanceToPlanes / abs(rayDir);
            t += eps + min(tDeltasToPlanes.x, min(tDeltasToPlanes.y, tDeltasToPlanes.z));

          }
          gl_FragColor = vec4(getSky(rayDir.xy), 1);

        }


        `,

      vert: `
        precision mediump float;
        attribute vec2 position;
        void main() {
          gl_Position = vec4(position, 0, 1);
        }`,

      // Here we define the vertex attributes for the above shader
      attributes: {
        // regl.buffer creates a new array buffer object
        position: this.regl.buffer([
          [-1, -1],   // no need to flatten nested arrays, regl automatically
          [1, -1],    // unrolls them into a typedarray (default Float32)
          [1,  1],
          [-1, 1]
        ]),
      },

      elements: [
        [0, 1, 2],
        [0, 3, 2],
      ],

      uniforms: {
        // This defines the color of the triangle to be a dynamic variable
        color: this.regl.prop('color'),
        blocks: (() => {
          var blocksReshape = ndarray(this.blocks.data, [worldSize, worldSize**2, 4])
          var blocksTexture = this.regl.texture(blocksReshape)
          return blocksTexture
        }),
        viewportSize: context => ([context.viewportWidth, context.viewportHeight, ]),
        invProjection: invProjectionMatrix,
        invView: invViewMatrix,
        imageTexture: imageTexture,
      },

      // This tells regl the number of vertices to draw in this command
      count: 6
    })


    // regl.frame() wraps requestAnimationFrame and also handles viewport changes
    this.regl.frame(({time}) => {
      stats.begin()
      this.regl.clear({
        color: [0, 0, 0, 0],
        depth: 1
      })
      this.controls.externalTick(1/60)
      //console.log(this.camera.matrixWorld.elements)
      drawTriangle({
        color: [
          Math.cos(time * 1),
          Math.sin(time * 0.8),
          Math.cos(time * 3),
          1
        ]
      })
      stats.end()
    })

  }

  resizeCanvasAndCamera() {
    const canvas = this.canvasRef.current
    const { height, width} = canvas.getBoundingClientRect();
    canvas.width = width
    canvas.height = height
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
          </div>
        </div>
      </div>
    )
  }
}

class VoxelsThreeJS extends React.Component {
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
    for (var i = 0; i < size1; i++) {
      array[i] = new Array()
      for (var j = 0; j < size2; j++){
        array[i][j] = new Array()
        for (var k = 0; k < size3; k++) {
          array[i][j][k] = 0//Math.floor(Math.random()*2)
          if (j == 0) {
            array[i][j][k] = 1
          }
        }
      }
    }
    return array
  }

  iterator3D(array, func) {
    for (var i = 0; i < array.length; i++) {
      for (var j = 0; j < array[0].length; j++){
        for (var k = 0; k < array[0][0].length; k++) {
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

  constructor(camera, domElement, blocks) {
    this.camera = camera
    this.domElement = domElement
    this.blocks = blocks


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

  argmax(vector3) {
    if (vector3.x > vector3.y) {
      if (vector3.z > vector3.x) {
        return 2
      }
      return 0
    } else {
      if (vector3.z > vector3.y) {
        return 2
      }
      return 1
    }
  }

  abs(vector3) {
    var absVec = new THREE.Vector3(Math.abs(vector3.x), Math.abs(vector3.y), Math.abs(vector3.z))
    return absVec
  }

  checkCollisionUpdateVel(newLocation, velocity) {
    var playerBox = new THREE.Box3(new THREE.Vector3(newLocation.x - 0.5, newLocation.y - 1.5, newLocation.z - 0.5), new THREE.Vector3(newLocation.x +0.5, newLocation.y + 0.5, newLocation.z + 0.5))

    // only works with this exact box shape (1x1x2), can prob generalize if need
    // if want to make playerBox smaller, add a Box3.intersects check after if(isBlock) {...}
    var xLocations = [Math.floor(playerBox.min.x), Math.floor(playerBox.max.x)]
    var yLocations = [Math.floor(playerBox.min.y), Math.floor(playerBox.min.y+1), Math.floor(playerBox.max.y)]
    var zLocations = [Math.floor(playerBox.min.z), Math.floor(playerBox.max.z)]

    for (var i=0; i < xLocations.length; i++) {
      for (var j=0; j < yLocations.length; j++) {
        for (var k=0; k < zLocations.length; k++) {

          var possibleBlock = new THREE.Vector3(xLocations[i], yLocations[j], zLocations[k])
          var isWithinBounds = possibleBlock.clone().clamp(new THREE.Vector3(0,0,0), (new THREE.Vector3(...this.blocks.shape)).subScalar(1)).equals(possibleBlock)
          if (isWithinBounds) {
            var isBlock = this.blocks.get(xLocations[i], yLocations[j], zLocations[k], 3) != 0
            if (isBlock) {
              var bodyRef
              if (j == 0) {
                bodyRef = (new THREE.Vector3(0, -1, 0)).add(newLocation) // reference from bottom block of body
              } else if (j == 1) {
                bodyRef = (new THREE.Vector3(0, -0.5, 0)).add(newLocation) // reference from middle of body
              } else if (j == 2) {
                bodyRef = newLocation // reference from top of body
              }
              var normal = new THREE.Vector3(0, 0, 0)
              var dist = possibleBlock.clone().addScalar(0.5).sub(bodyRef) // vector from bodyRef to block Center
              var maxDim = this.argmax(this.abs(dist))
              normal.setComponent(maxDim, -Math.sign(dist.getComponent(maxDim)))

              if (Math.sign(velocity.getComponent(maxDim)) == -normal.getComponent(maxDim)) {
                velocity.setComponent(maxDim, 0)
              }
            }
          }
        }
      }
    }

    return false
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


    var candidateVelocity = this.velocity.clone().add(forceVector)
    candidateVelocity.clampLength(0, this.maxVelocity) // convenient
    var candidatePosition = this.camera.position.clone().add(candidateVelocity)

    this.checkCollisionUpdateVel(candidatePosition, candidateVelocity)
    this.velocity = candidateVelocity
    var newPosition = this.camera.position.clone().add(candidateVelocity)
    this.camera.position.set(newPosition.x, newPosition.y, newPosition.z)

    // Camera rotation
    // Can move head more than 90 deg if move camera quickly
    var cameraCrossVec = (new THREE.Vector3(0, 1, 0)).cross(cameraDirection).normalize()
    var angleToStraightUpDown = cameraDirection.angleTo(new THREE.Vector3(0, 1, 0)) // straight up and down
    const minAngle = 0.27
    var tiltDir = Math.sign(this.mouseMoveBuffer.y)
    if ((angleToStraightUpDown < minAngle && tiltDir == 1) || (angleToStraightUpDown > (Math.PI - minAngle) && tiltDir == -1) || (angleToStraightUpDown > minAngle && angleToStraightUpDown < (Math.PI - minAngle))) {
      this.camera.rotateOnWorldAxis(cameraCrossVec, this.rotationSensitivty * this.mouseMoveBuffer.y)
    }
    this.camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -this.rotationSensitivty * this.mouseMoveBuffer.x)

    this.mouseMoveBuffer = {x: 0, y: 0}

  }

}

module.exports = Voxels
