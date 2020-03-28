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

class VoxelRenderer {
  constructor(options) {
    const worldSize = options.worldSize
    if (!options.canvas) {
      this.canvas = document.createElement('canvas')
      this.canvas.style.cssText ="position: absolute; top:0; left:0; height: 100%; width: 100%"
      this.canvas.style.zIndex ="-1"
      document.body.appendChild(this.canvas);
    } else {
      this.canvas = options.canvas
    }

    // parents can access stats.dom to show
    this.stats = new Stats();
    this.stats.showPanel(0);

    // target scenes to be rendered, see addTarget()
    this.idCounter = 0
    this.targets = []

    this.regl = Regl({
      canvas: this.canvas,
      extensions: ["OES_texture_float", 'EXT_shader_texture_lod', "OES_standard_derivatives"],
      onDone: function (err, regl) {
        if (err) {
          console.log(err)
          return
        }
      }
    })

    this.listeners = []
    // this.addEventListener(window, "resize", () => this.render()) //regl.frame handles this already

    // var image = new Image()
    // image.src = 'https://i.imgur.com/0B6nUmB.jpg'
    // image.crossOrigin = "";
    // image.onload = () => {imageTexture(image)}
    var imageTexture = this.regl.texture()

    const fragmentShader = `
      #extension GL_EXT_shader_texture_lod : enable
      #extension GL_OES_standard_derivatives : enable

      precision mediump float;
      // precision highp float;
      uniform vec4 color;
      uniform sampler2D blocks;
      uniform sampler2D imageTexture;

      uniform vec2 viewportSize;
      uniform vec2 fragCoordOffset;
      uniform float topBorderRadius; //hack-y but can't clip abs background

      uniform mat4 invProjection;
      uniform mat4 invView;
      uniform float timeMS;
      uniform sampler2D colorStorage;
      const float worldSize = ${worldSize[0].toFixed(1)};
      const int maxRaymarchSteps = 50;
      const float PI = 3.1415926535;

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

      vec4 blockValueAtIndex(vec3 index) {
        if (clamp(index, 0.0, float(worldSize) - 1.0) == index) {
          vec2 blockIdxs = vec2(index.x,index.y*worldSize + index.z);
          vec4 blockValue = texture2DLodEXT(blocks, blockIdxs/vec2(worldSize, worldSize*worldSize), 0.0);
          return blockValue;
        } else {
           return vec4(0, 0, 0, 0);
         }
      }

      // Slower
      vec4 raymarchToBlockNoBranching(vec3 startPos, vec3 rayDir, out vec3 blockIdx, out vec3 hitPos) {
        vec3 edge;
        vec4 blockValue = vec4(0, 0, 0, 0);
        vec3 outRayPos;

        const float eps = 0.0001;
        float t = 0.0;
        for(int i=0; i<maxRaymarchSteps; i++) {
          vec3 rayPos = startPos + rayDir * t;

          bool inWorld = clamp(rayPos, 0.0, float(worldSize) - 0.0000000001) == rayPos;
          vec3 possibleEdge = vec3(floor(rayPos.x), floor(rayPos.y), floor(rayPos.z));
          vec4 possibleBlock = blockValueAtIndex(possibleEdge);
          float shouldUpdateOutputs = float(inWorld && possibleBlock.a != 0.0 && blockValue.a == 0.0);

          edge = shouldUpdateOutputs * possibleEdge + (1.0-shouldUpdateOutputs) * edge;
          blockValue = shouldUpdateOutputs * possibleBlock + (1.0-shouldUpdateOutputs) * blockValue;
          outRayPos = shouldUpdateOutputs * rayPos + (1.0-shouldUpdateOutputs) * outRayPos;

          vec3 distanceToPlanes = step(vec3(0, 0, 0), rayDir)*(1.0 - fract(rayPos)) + (1.0 - step(vec3(0, 0, 0), rayDir))*(fract(rayPos));
          vec3 tDeltasToPlanes = distanceToPlanes / abs(rayDir);
          t += eps + min(tDeltasToPlanes.x, min(tDeltasToPlanes.y, tDeltasToPlanes.z));
        }

        hitPos = outRayPos;
        blockIdx = edge;
        return blockValue;
      }

      vec4 raymarchToBlock(vec3 startPos, vec3 rayDir, out vec3 blockIdx, out vec3 hitPos) {
        // const float eps = 0.0001;
        const float eps = 0.00001;
        float t = 0.0;
        for(int i=0; i<maxRaymarchSteps; i++) {
          vec3 rayPos = startPos + rayDir * t;

          vec3 edge = vec3(floor(rayPos.x), floor(rayPos.y), floor(rayPos.z));
          vec4 blockValue = blockValueAtIndex(edge);

          if (blockValue.a != 0.0) {
            blockIdx = edge;
            hitPos = rayPos;
            return blockValue;
          }

          // round down if negative rayDir, round up if positive rayDir
          // need to get distance in direction of ray so sign matters
          vec3 distanceToPlanes = step(vec3(0, 0, 0), rayDir)*(1.0 - fract(rayPos)) + (1.0 - step(vec3(0, 0, 0), rayDir))*(fract(rayPos));
          vec3 tDeltasToPlanes = distanceToPlanes / abs(rayDir);
          t += eps + min(tDeltasToPlanes.x, min(tDeltasToPlanes.y, tDeltasToPlanes.z));
        }

        // default values
        hitPos = vec3(0, 0, 0);
        blockIdx = vec3(0, 0, 0);
        return vec4(0, 0, 0, 0);
      }

      // math.stackexchange.com/questions/1014010/how-would-i-calculate-the-area-of-a-rectangle-on-a-sphere-using-vertical-and-hor
      float sphereRectangleAreaFromAngles(float angle1, float angle2) {
        float alpha = angle1/2.0;
        float beta = angle2/2.0;
        float Abar = atan(sin(beta) / tan(alpha));
        float Bbar = atan(sin(alpha) / tan(beta));
        float cosGamma = cos(alpha)*cos(beta);
        float C = acos(sin(Abar)*sin(Bbar)*cosGamma - cos(Abar)*cos(Bbar));
        float area = 4.0*C - 2.0*PI;
        return area;
      }

      // from inigo quiliez
      float opSmoothUnion( float d1, float d2, float k ) {
        float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
        return mix( d2, d1, h ) - k*h*(1.0-h); }

      // super heuristic-y (mainly edge dist). returns an alpha, so more AO => lower ret val.
      float ambientOcclusion(vec3 blockIdx, vec3 hitPos, vec3 hitNorm) {

        vec3 sideDirs[4];
        vec3 cornerDirs[4];

        if (abs(hitNorm) == vec3(0, 1, 0)) {
          sideDirs[0] = vec3(1, 0, 0);
          sideDirs[1] = vec3(0, 0, 1);
          sideDirs[2] = vec3(-1, 0, 0);
          sideDirs[3] = vec3(0, 0, -1);
          cornerDirs[0] = vec3(1, 0, 1);
          cornerDirs[1] = vec3(-1, 0, 1);
          cornerDirs[2] = vec3(-1, 0, -1);
          cornerDirs[3] = vec3(1, 0, -1);
        } else if (abs(hitNorm) == vec3(1, 0, 0)) {
          sideDirs[0] = vec3(0, 1, 0);
          sideDirs[1] = vec3(0, 0, 1);
          sideDirs[2] = vec3(0, -1, 0);
          sideDirs[3] = vec3(0, 0, -1);
          cornerDirs[0] = vec3(0, 1, 1);
          cornerDirs[1] = vec3(0, -1, 1);
          cornerDirs[2] = vec3(0, -1, -1);
          cornerDirs[3] = vec3(0, 1, -1);
        } else if (abs(hitNorm) == vec3(0, 0, 1)) {
          sideDirs[0] = vec3(0, 1, 0);
          sideDirs[1] = vec3(1, 0, 0);
          sideDirs[2] = vec3(0, -1, 0);
          sideDirs[3] = vec3(-1, 0, 0);
          cornerDirs[0] = vec3(1, 1, 0);
          cornerDirs[1] = vec3(1, -1, 0);
          cornerDirs[2] = vec3(-1, -1, 0);
          cornerDirs[3] = vec3(-1, 1, 0);
        }

        float ambientOcclusionAlpha = 1.0;
        float avgDist = 1.0;

        for (int i=0; i<4; i++) {
          vec3 adjacentBlockPos = blockIdx + hitNorm + sideDirs[i];
          vec4 adjacentBlockVal = blockValueAtIndex(adjacentBlockPos);
          if (adjacentBlockVal.a != 0.0) {
            float dist = length(abs(sideDirs[i]) * abs(adjacentBlockPos + vec3(0.5, 0.5, 0.5) - hitPos)) - 0.5;
            avgDist = opSmoothUnion(avgDist, dist, 0.2);
          }
        }

        for (int i=0; i<4; i++) {
          vec3 adjacentBlockPos = blockIdx + hitNorm + cornerDirs[i];
          vec4 adjacentBlockVal = blockValueAtIndex(adjacentBlockPos);
          if (adjacentBlockVal.a != 0.0) {
            vec3 cornerPos = adjacentBlockPos + vec3(0.5, 0.5, 0.5) - cornerDirs[i] * 0.5;
            float dist = length(abs(cornerDirs[i]) * abs(cornerPos - hitPos));
            avgDist = min(avgDist, dist);
          }
        }

        // gl_FragColor = vec4(1, 0, 0, 1) * avgDist;
        // return;
        const float shadowClosenessToSide = 7.0;
        const float shadowLightness = 3.0;
        ambientOcclusionAlpha = 1.0 - pow(1.0 - avgDist, shadowClosenessToSide)/shadowLightness;
        return ambientOcclusionAlpha;
      }

      bool borderRadius(vec2 FragCoord) {
        // const float radius = 14.0 - 1.0;
        float radius = topBorderRadius - 1.0;
        vec2 distanceFromInnerCorner = vec2(-1, -1);

        // should be viewportSize.x - 1 - radius, etc, but this matches browser borderRadius
        if (FragCoord.x <= radius) {
          distanceFromInnerCorner.x = radius - FragCoord.x;
        } else if (FragCoord.x >= viewportSize.x - radius) {
          distanceFromInnerCorner.x = FragCoord.x - (viewportSize.x - radius);
        }
        // if (FragCoord.y <= radius) {
        //   distanceFromInnerCorner.y = radius - FragCoord.y;
        // }
        if (FragCoord.y >= viewportSize.y - radius) {
          distanceFromInnerCorner.y = FragCoord.y - (viewportSize.y - radius);
        }
        if (distanceFromInnerCorner.y != -1.0 && distanceFromInnerCorner.x != -1.0  && length(distanceFromInnerCorner) > radius) {
          return true;
        }
        return false;
      }

      void main() {
        vec2 FragCoord = gl_FragCoord.xy - fragCoordOffset;
        bool isAlpha = borderRadius(FragCoord);
        if (isAlpha) {
          gl_FragColor = vec4(0,0,0,0);
          return;
        }
        // Add center cursor
        if (length(FragCoord - (viewportSize.xy / 2.0)) < 2.0) {
          gl_FragColor = vec4(0.2, 0.2, 0.2, 1);
          return;
        }

        // gl_FragColor = vec4(1,1,1,0);
        // return;

        vec2 scaledScreenCoord = 2.0 * ((FragCoord / viewportSize.xy) - 0.5); // -1 to 1
        mat4 inverseViewProjection = invView * invProjection;
        vec4 unscaledWorldCoords = inverseViewProjection * vec4(scaledScreenCoord, 0, 1);
        vec3 worldCoords = unscaledWorldCoords.xyz / unscaledWorldCoords.w;
        vec3 cameraPos = (invView * vec4(0, 0, 0, 1)).xyz;

        vec3 rayDir = normalize(worldCoords - cameraPos);
        const vec3 lightDir = normalize(vec3(1, -1, 1));

        vec3 hitPos;
        vec3 blockIdx;
        // vec4 blockValue = raymarchToBlockBranching(cameraPos, rayDir, blockIdx, hitPos);
        vec4 blockValue = raymarchToBlock(cameraPos, rayDir, blockIdx, hitPos);

        // no block hit
        if (blockValue.a == 0.0) {
          gl_FragColor = vec4(getSky(rayDir.xy), 1);
          return;
        }

        vec3 hitDists = hitPos - (blockIdx + 0.5);
        vec3 hitNorm = vec3(ivec3(hitDists / maxOf(abs(hitDists))));

        float ambientOcclusionAlpha = ambientOcclusion(blockIdx, hitPos, hitNorm);

        vec3 lightReflectionRay = lightDir - 2.0*dot(lightDir, hitNorm)*hitNorm;
        float reflectRayCosSim = dot(-rayDir, lightReflectionRay);
        float rayNormCosSim = dot(-rayDir, hitNorm);

        vec2 textureCoords = twoNonZero((1.0 - hitNorm) * (hitDists + 0.5));

        vec3 isSideHit = floor(abs(hitDists) / 0.495);
        bool isEdge = isSideHit.x + isSideHit.y + isSideHit.z >= 2.0;
        bool shouldDrawEdge = blockValue.x == 1.0/255.0;

        if (false && length(hitDists) > 0.8) {
          gl_FragColor = vec4(0, 0, 0, 1); // corner marks
        } else if (isEdge && shouldDrawEdge) {
          // gl_FragColor = vec4(0.95, 0.95, 0.95, 1); // edge marks
          gl_FragColor = vec4(0, 0, 0, 1); // edge marks
        } else {
          if (dot(hitNorm, -lightDir) < 0.0) {
            reflectRayCosSim = 0.0;
          }
          float blockIdx = floor(blockValue.a * 255.0) - 1.0;
          vec3 blockColor = texture2DLodEXT(colorStorage, vec2(blockIdx/16.0, 0.0), 0.0).rgb;
          vec3 colorMix  = (0.0*reflectRayCosSim + 0.6*rayNormCosSim + 0.66) * blockColor * ambientOcclusionAlpha;
          // vec3 colorMix  = blockColor * ambientOcclusionAlpha;
          gl_FragColor = vec4(colorMix, 1);
          // gl_FragColor = vec4(textureCoords, 0.0, 1.0);
          // gl_FragColor = texture2D(imageTexture, textureCoords);
        }
      }
    `
    this.drawCommand = this.regl({
      frag: fragmentShader,

      vert: `
        precision mediump float;
        attribute vec2 position;
        void main() {
          gl_Position = vec4(position, 0, 1);
        }`,

      attributes: {
        position: this.regl.buffer([[-1, -1], [1, -1], [1,  1], [-1, 1], ]),
      },

      elements: [[0, 1, 2], [0, 3, 2],],

      uniforms: {
        // This defines the color of the triangle to be a dynamic variable
        color: this.regl.prop('color'),
        blocks: (context, props) => {
          var blocksReshape = ndarray(props.blockManager.data, [worldSize[0], worldSize[1]*worldSize[2], 4])
          var blocksTexture = this.regl.texture(blocksReshape)
          return blocksTexture
          return null
        },
        viewportSize: (context) => {
          return ([context.viewportWidth, context.viewportHeight])
        },
        fragCoordOffset: (context, props) => props.fragCoordOffset,
        invProjection: (context, props) => {
          // gl-mat4 wasn't getting an inverse matrix (mb bcz NaN in perspective matrix?)
          return props.camera.projectionMatrixInverse.elements
        },
        invView: (context, props) => {
          // view matrix is this.camera.matrixWorldInverse
          return props.camera.matrixWorld.elements
        },
        imageTexture: imageTexture,
        timeMS: (() => (Date.now() / 1000) % 6.28),
        colorStorage: (context, props) => {
          return this.regl.texture([props.gameState.blockColors.map(c => this.hexToRGB(c.hex))])
        },
        topBorderRadius: (context, props) => (options.topBorderRadius || 0),
      },

      count: 6,
    })

    // regl.frame() wraps requestAnimationFrame and also handles viewport changes
    // maybe can remove the "resize" listener
    var frameCount = 0
    this.regl.frame(({time}) => {
      frameCount += 1
      this.stats.begin()
      this.regl.clear({
        color: [0, 0, 0, 0],
        depth: 1
      })
      this.render()
      //console.log(this.camera.matrixWorld.elements)
      this.stats.end()
    })

    this.temp = {}
  }

  // should probably just take a gameState, element in the future
  // camera is THREE.js camera, element is standard DOMelement
  // see render() for what a target is
  addTarget(target) {
   this.idCounter +=1
   this.targets[this.idCounter] = target
   this.render()
   return this.idCounter
  }

  removeTarget(targetID) {
    delete this.targets[targetID]
  }

  addEventListener(obj, eventName, func) {
    this.listeners.push([obj, eventName, func])
    obj.addEventListener(eventName, func)
  }

  destroy() {
    this.listeners.map(([obj, eventName, func]) => obj.removeEventListener(eventName, func))
    this.regl.destroy()
    this.canvas.remove()
  }

  hexToRGB(h) {
    return [+("0x"+h[1]+h[2]), +("0x"+h[3]+h[4]), +("0x"+h[5]+h[6])]
  }


  render() {
    const canvasRect = this.canvas.getBoundingClientRect();
    // window.devicePixelRatio i.e. retina (4x pixels) is crisp and beautiful but too laggy
    const pixelRatio = 1//0.05;
    this.canvas.width = canvasRect.width * pixelRatio
    this.canvas.height = canvasRect.height * pixelRatio

    // this.canvas.style.top= `${window.scrollY}px)`; // only changes position if element absolute
    this.canvas.style.transform = `translateY(${window.scrollY}px)`;

    for (var key in this.targets) {
      const {blockManager, gameState, camera, element} = this.targets[key]
      const targetRect = element.getBoundingClientRect();
      if (targetRect.bottom < canvasRect.top || targetRect.top  > canvasRect.bottom ||
          targetRect.right  < canvasRect.left || targetRect.left > canvasRect.right) {
        continue;// target is fully clipped
      }

      // partial-clipping might still be rendered and then discarded
      const width  = targetRect.right - targetRect.left
      const height = targetRect.bottom - targetRect.top
      const left   = targetRect.left - canvasRect.left
      const bottom = canvasRect.bottom - targetRect.bottom
      const clipBox = {x: left * pixelRatio, y: bottom * pixelRatio, width: width * pixelRatio, height: height * pixelRatio}
      const fragCoordOffset = [clipBox.x, clipBox.y] // gl_FragCoord doesn't change with viewport or scissor

      var clippedDraw = this.regl({
        scissor: {
          enable: false,
          box: clipBox,
        },
        viewport: clipBox,
      })
      clippedDraw(context => {
        this.drawCommand({blockManager, gameState, camera, fragCoordOffset})
      })
    }
  }

}

class VoxelEditor extends React.Component {

  constructor(props) {
    super(props)
    this.canvasRef = React.createRef()
    this.containerRef = React.createRef()
    this.gameState = new GameState()
  }

  componentDidMount() {
    // Initialize blocks
    const worldSize = [17, 17, 17] //# blocks makes no diff when staring off into void
    this.blockManager = new BlockManager(worldSize)


    this.camera = new THREE.PerspectiveCamera(95, 1.0, 0.1, 1000)
    this.controls = new FlyControls(this.camera, this.canvasRef.current, this.blockManager, this.gameState)
    this.camera.position.set(worldSize[0]/2.0, 10, 0)
    this.camera.lookAt(new THREE.Vector3(worldSize[0]/2.0, 0, worldSize[2]/2.0))

    this.resizeCamera()
    this.listeners = []
    this.addEventListener(window, "resize", () => this.resizeCamera())

    this.voxelRenderer = new VoxelRenderer({canvas: this.canvasRef.current, worldSize})
    // this.voxelRenderer = new VoxelRenderer({worldSize, topBorderRadius: 14})
    this.voxelRenderer.addTarget({blockManager: this.blockManager, gameState: this.gameState, camera: this.camera, element: this.canvasRef.current})
    this.containerRef.current.appendChild(this.voxelRenderer.stats.dom)

    var tick = timestamp => {
      this.controls.externalTick(1/60)
      window.requestAnimationFrame(tick)
    }
    window.requestAnimationFrame(tick)

  }

  addEventListener(obj, eventName, func) {
    this.listeners.push([obj, eventName, func])
    obj.addEventListener(eventName, func)
  }

  componentWillUnmount() {
    this.listeners.map(([obj, eventName, func]) => obj.removeEventListener(eventName, func))
    this.voxelRenderer.destroy()
  }

  resizeCamera() {
    const canvas = this.canvasRef.current
    const { height, width} = canvas.getBoundingClientRect();
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  render() {
    return (
      <div style={{width: "100%", height:"100%"}}>
        <div style={{display: "flex", flexDirection: "row", padding: THEME.sizing.scale1000, boxSizing: "border-box", height: "100%"}}>
          <div ref={this.containerRef} style={{flexGrow: "1", display: "flex", flexDirection: "column"}}>
            <div style={{boxShadow: "0px 1px 2px #ccc", border: "1px solid #fff", borderRadius: "14px", overflow: "hidden", flexGrow: "1"}}>
              <canvas ref={this.canvasRef} style={{height: "100%", width: "100%"}}/>
            </div>
          </div>
          <div style={{height: "300px",boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", padding: THEME.sizing.scale600, marginLeft: THEME.sizing.scale1000}}>
            <GameControlPanel gameState={this.gameState}/>
            testing123
          </div>
        </div>
      </div>
    )
  }
}

class GameState {

  // modified Island Joy 16: kerrielake
  blockColors = [
    {id:0,name: "white", hex: "#ffffff"},
    {id:1,name: "peach", hex: "#f7b69e"},
    {id:2,name: "clayRed", hex: "#cb4d68"},
    {id:3,name: "crimson", hex: "#c92464"},
    {id:4,name: "orange", hex: "#f99252"},
    {id:5,name: "yellow", hex: "#f7e476"},
    {id:6,name: "livelyGreen", hex: "#a1e55a"},
    {id:7,name: "leafGreen", hex: "#5bb361"},
    {id:8,name: "teal", hex: "#6df7c1"},
    {id:9,name: "waterBlue", hex: "#11adc1"},
    {id:10,name: "coralBlue", hex: "#1e8875"},
    {id:11,name: "royalPurple", hex: "#6a3771"},
    {id:12,name: "deepPurple", hex: "#393457"},
    {id:13,name: "gray", hex: "#606c81"},
    {id:14,name: "brown", hex: "#644536"},
    {id:15,name: "rock", hex: "#9b9c82"},
  ]

  constructor() {
    this.selectedBlockColor = 1
  }
}

class GameControlPanel extends React.Component {
  constructor(props) {
    super(props)
    this.gameState = props.gameState
    this.state = {
      selectedBlockColor: this.gameState.selectedBlockColor
    }
    this.listeners = []
    this.addEventListener(window, "keydown", e => {
      var key = e.key
      var gridWidth = 4
      var gridHeight = 4
      var row = Math.floor((this.state.selectedBlockColor - 1) / gridWidth)
      var col = (this.state.selectedBlockColor - 1) % gridWidth
      if (key == "ArrowLeft") {
        col -= 1
      } else if (key == "ArrowRight") {
        col += 1
      } else if (key == "ArrowUp") {
        row -= 1
      } else if (key == "ArrowDown") {
        row += 1
      }
      if (row >= 0 && col >= 0 && row < gridHeight && col < gridWidth) {
        this.setSelectedBlockColor((row * gridWidth + col) + 1)
      }
    })
  }

  addEventListener(obj, eventName, func) {
    this.listeners.push([obj, eventName, func])
    obj.addEventListener(eventName, func)
  }

  componentWillUnmount() {
    this.listeners.map(([obj, eventName, func]) => obj.removeEventListener(eventName, func))
  }

  setSelectedBlockColor(selectedBlockColor) {
    this.setState({selectedBlockColor: selectedBlockColor})
    this.gameState.selectedBlockColor = selectedBlockColor
  }

  render() {
    return (
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr"}}>
        {this.gameState.blockColors.map(color => {
          var isSelected = this.state.selectedBlockColor == color.id + 1
          var border = isSelected ? "2px solid #00C5CD" : "1px solid #000"
          var size = isSelected ? 28 : 30 //not sure why 30px vs 31px results in no visible size change.
          var onClick = e => {
            this.setSelectedBlockColor(color.id + 1)
          }
          var div = <div
            style={{margin: THEME.sizing.scale400, backgroundColor: color.hex, height: `${size}px`, width: `${size}px`, borderRadius: "5px", cursor: "pointer", border}}
            onClick={onClick}
            key={color.hex}
            >
          </div>
          return div
        })}
      </div>
    )
  }

}

class BlockManager {

  constructor(worldSize) {
    this.worldSize = worldSize
    this.blocks = ndarray(new Uint8Array(4*worldSize[0]*worldSize[1]*worldSize[2]), [...worldSize, 4])
    for (var i =0; i < worldSize[0]; i++) {
      for(var j=0; j < worldSize[1]; j++) {
        for(var k=0; k < worldSize[2]; k++) {
          if (j == 1 && i == 1) {
            this.blocks.set(i, j, k, 3, k + 1)
          }
          if (Math.random() > 0.90) {
            this.blocks.set(i, j, k, 3, 1 + Math.floor(Math.random()*16))
          }
          // let color = randomColor({format:"rgbArray"})
          if (j == 0) {
            // this.blocks.set(i, j, k, 3, 1)
          }
        }
      }
    }
    this.data = this.blocks.data
  }

  blockExists(pos) {
    if (!this.withinWorldBounds(pos)) {
      return false
    }
    let exists = this.blocks.get(pos.x, pos.y, pos.z, 3) != 0
    return exists
  }

  addBlock(pos, id) {
    this.blocks.set(pos.x, pos.y, pos.z, 3, id)
  }

  removeBlock(pos, id) {
    this.blocks.set(pos.x, pos.y, pos.z, 3, 0)
  }

  toggleBlockOutline(pos, status) {
    this.blocks.set(pos.x, pos.y, pos.z, 0, status ? 1 : 0)
  }

  withinWorldBounds(pos) {
    var within = true
    within = within && (pos.x < this.worldSize[0]) && (pos.x >= 0)
    within = within && (pos.y < this.worldSize[1]) && (pos.y >= 0)
    within = within && (pos.z < this.worldSize[2]) && (pos.z >= 0)
    return within
  }

  // normalize dirVec
  raymarchToBlock (posVec, dirVec, maxDist) {
    var fract = n => n - Math.floor(n)
    var rayPos = posVec.clone()
    var t = 0
    while(t < maxDist) {
      var blockPos = rayPos.clone().floor()
      if (this.blockExists(blockPos)) {
        var hitPos = rayPos
        return [blockPos, hitPos]
      }
      var timeToPlaneX = (dirVec.x > 0) ? (1 - fract(rayPos.x)) : (fract(rayPos.x) / Math.abs(dirVec.x))
      var timeToPlaneY = (dirVec.y > 0) ? (1 - fract(rayPos.y)) : (fract(rayPos.y) / Math.abs(dirVec.y))
      var timeToPlaneZ = (dirVec.z > 0) ? (1 - fract(rayPos.z)) : (fract(rayPos.z) / Math.abs(dirVec.z))
      var deltaT = 0.00001 + Math.min(timeToPlaneX, timeToPlaneY, timeToPlaneZ)
      t += deltaT
      rayPos.add(dirVec.clone().multiplyScalar(deltaT))
    }
    return null
  }
}

class FlyControls {

  constructor(camera, domElement, blockManager, gameState) {
    this.camera = camera
    this.domElement = domElement
    this.blockManager = blockManager
    this.gameState = gameState

    this.listeners = []
    this.addEventListener(window, "keydown", e => {
      this.capturingMouseMovement && this.updateKeystates(e.key, true)
      e.key == " " && e.preventDefault() // prevent page scroll on spacebar
      e.key == "e" && this.toggleMouseCapture()
    })
    this.addEventListener(window, "keyup", e => {
      this.capturingMouseMovement && this.updateKeystates(e.key, false)
    })
    this.addEventListener(domElement, "mousedown", e => {
      if (e.which == 1) { // left click
        if (!this.capturingMouseMovement) {
          this.domElement.requestPointerLock()
        } else {
          this.clickBuffer.click += 1
        }
      } else if (e.which == 3) {
          this.clickBuffer.rightClick += 1
      }
    })
    this.addEventListener(document, 'pointerlockchange', () => {
      if (!(document.pointerLockElement == this.domElement)) {
        this.capturingMouseMovement = false
        this.keyState = {} // prevent sticky keys
      } else {
        this.capturingMouseMovement = true
      }
    });
    this.addEventListener(domElement,"mouseup", e => {
    })
    this.addEventListener(domElement, "mousemove", e => this.capturingMouseMovement && this.updateMouseBuffer(e.movementX, e.movementY))

    this.keyState = {}
    this.mouseMoveBuffer = {x: 0, y: 0}
    this.clickBuffer = {click: 0, rightClick: 0}
    this.captureMouseMovement = false

    // Configuration
    this.toggleMouseCaptureKey = "e"
    this.maxVelocity = 0.2 // in units/seconds
    this.timeToReachMaxSpeed = 0.6 // in seconds
    this.timeToReachZeroSpeed = 0.2 // in seconds
    this.velocity = new THREE.Vector3(0, 0, 0)
    this.rotationSensitivty = 0.005 // in radians per (pixel of mouse movement)

    // Special callback used for e.g. removing block selection
    this.onNextTick = null

  }

  addEventListener(obj, eventName, func) {
    this.listeners.push([obj, eventName, func])
    obj.addEventListener(eventName, func)
  }

  componentWillUnmount() {
    this.listeners.map(([obj, eventName, func]) => obj.removeEventListener(eventName, func))
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

  blockNormalAtLocation(blockIdx, location) {
    var normal = new THREE.Vector3(0, 0, 0)
    var dist = blockIdx.clone().addScalar(0.5).sub(location) // vector from location to block Center
    var maxDim = this.argmax(this.abs(dist))
    normal.setComponent(maxDim, -Math.sign(dist.getComponent(maxDim)))
    return [normal, maxDim]
  }

  playerBox(location) {
    var playerBox = new THREE.Box3(new THREE.Vector3(location.x - 0.3, location.y - 1.3, location.z - 0.3), new THREE.Vector3(location.x +0.3, location.y + 0.3, location.z + 0.3))
    return playerBox
  }

  playerCollidesWithCube(potentialCubeIdx, location) {
    var playerBox = this.playerBox(location)
    var blockBox = new THREE.Box3(potentialCubeIdx.clone(), potentialCubeIdx.clone().addScalar(1))
    var isCollision = playerBox.intersectsBox(blockBox)
    return isCollision
  }

  //only checks 12 boxes around the player, returns collision force dir
  playerCollisions(newLocation) {
    var playerBox = this.playerBox(newLocation)

    // only works with this exact box shape (1x1x2), can prob generalize if need
    // if want to make playerBox smaller, add a Box3.intersects check after if(isBlock) {...}
    // seems like should be simpler way to do it, kinda convluted rn
    // also, method to get normal doesn't work reliable when flying into ground
    var xLocations = [Math.floor(playerBox.min.x), Math.floor(playerBox.max.x)]
    var yLocations = [Math.floor(playerBox.min.y), Math.floor(playerBox.min.y+1), Math.floor(playerBox.max.y)]
    var zLocations = [Math.floor(playerBox.min.z), Math.floor(playerBox.max.z)]

    var forceDir = new THREE.Vector3(0, 0, 0);

    for (var i=0; i < xLocations.length; i++) {
      for (var j=0; j < yLocations.length; j++) {
        for (var k=0; k < zLocations.length; k++) {

          var possibleBlock = new THREE.Vector3(xLocations[i], yLocations[j], zLocations[k])
          var isWithinBounds = possibleBlock.clone().clamp(new THREE.Vector3(0,0,0), (new THREE.Vector3(...this.blockManager.blocks.shape)).subScalar(1)).equals(possibleBlock)
          if (isWithinBounds) {
            // var isBlock = this.blocks.get(xLocations[i], yLocations[j], zLocations[k], 3) != 0
            var isBlock = this.blockManager.blockExists(possibleBlock)
            if (isBlock) {
              var blockBox = new THREE.Box3(possibleBlock.clone(), possibleBlock.clone().addScalar(1))
              var isCollision = playerBox.intersectsBox(blockBox)
              if (isCollision) {
                var bodyRef
                if (j == 0) {
                  bodyRef = (new THREE.Vector3(0, -1, 0)).add(newLocation) // reference from bottom block of body
                } else if (j == 1) {
                  bodyRef = (new THREE.Vector3(0, -0.5, 0)).add(newLocation) // reference from middle of body
                } else if (j == 2) {
                  bodyRef = newLocation // reference from top of body
                }
                var [normal, maxDim] = this.blockNormalAtLocation(possibleBlock, bodyRef)

                forceDir.setComponent(maxDim, normal.getComponent(maxDim))
              }
            }
          }
        }
      }
    }
    return forceDir
  }

  checkCollisionUpdateVel(newLocation, velocity) {
    var forceDir = this.playerCollisions(newLocation)
    for (var i =0; i<3; i++) {
      if (Math.sign(velocity.getComponent(i)) == -forceDir.getComponent(i)) {
        velocity.setComponent(i, 0)
      }
    }
  }

  externalTick(timeDelta) {
    this.onNextTick && this.onNextTick()
    this.onNextTick = null

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
    const minAngle = 0.2
    var tiltDir = Math.sign(this.mouseMoveBuffer.y)
    if ((angleToStraightUpDown < minAngle && tiltDir == 1) || (angleToStraightUpDown > (Math.PI - minAngle) && tiltDir == -1) || (angleToStraightUpDown > minAngle && angleToStraightUpDown < (Math.PI - minAngle))) {
      this.camera.rotateOnWorldAxis(cameraCrossVec, this.rotationSensitivty * this.mouseMoveBuffer.y)
    }
    this.camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -this.rotationSensitivty * this.mouseMoveBuffer.x)

    this.mouseMoveBuffer = {x: 0, y: 0}


    // interaction with blocks
    var raymarchResult = this.blockManager.raymarchToBlock(this.camera.position, cameraDirection, 5)
    if (raymarchResult) {
      var [blockPos, hitPos] = raymarchResult
      this.blockManager.toggleBlockOutline(blockPos, true)
      this.onNextTick = () => this.blockManager.toggleBlockOutline(blockPos, false)
    }

    if (this.clickBuffer.rightClick > 0) {
      if (raymarchResult) {
        var [blockPos, hitPos] = raymarchResult
        var [normal, dim] = this.blockNormalAtLocation(blockPos, hitPos)
        var newBlockPos = normal.add(blockPos)
        for (var i = 0; i< this.clickBuffer.rightClick; i++) {
          if (!this.playerCollidesWithCube(newBlockPos, this.camera.position)) {
            this.blockManager.addBlock(newBlockPos, this.gameState.selectedBlockColor)
          }
        }
      }
      this.clickBuffer.rightClick = 0
    } else if (this.clickBuffer.click > 0) {
      for (var i = 0; i< this.clickBuffer.click; i++) {
        var raymarchResult = this.blockManager.raymarchToBlock(this.camera.position, cameraDirection, 5)
        if (raymarchResult) {
          var [blockPos, hitPos] = raymarchResult
          this.blockManager.removeBlock(blockPos)
        }
      }
      this.clickBuffer.click = 0
    }
  }
}

// ALTERNATIVE COMPONENTS (NOT USED):

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



module.exports = {
  VoxelEditor,
  VoxelRenderer,
  GameState,
  BlockManager,
  FlyControls,
}
