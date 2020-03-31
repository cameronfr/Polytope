var React = require("react")
var ReactDOM = require("react-dom")
import { Router, Link as RawRouterLink, navigate } from "@reach/router"
// import "core-js/stable";
import "regenerator-runtime/runtime";

// Web3 stuff
var Web3 = require("web3");

// Voxel Stuff
import {VoxelEditor, VoxelRenderer, FlyControls, GameState, AutomaticOrbiter, WorldGenerator, ControlsHelpTooltip} from "./voxels.jsx"
import {Vector3, PerspectiveCamera} from 'three';
import {ApparatusGenerator} from "./procedural.jsx"


// Baseweb UI stuff
const CopyToClipboard = require('clipboard-copy')
import {Client as Styletron} from 'styletron-engine-atomic';
import {Provider as StyletronProvider} from 'styletron-react';
import {useStyletron} from 'baseui';
import {LightTheme, BaseProvider, styled} from 'baseui';
import { StyledLink } from "baseui/link";
import { Button, KIND, SIZE } from "baseui/button";
import { Input } from "baseui/input"
import { Search } from "baseui/icon";
// import { Notification, KIND as NotificationKind } from "baseui/notification";
import { toaster, ToasterContainer } from "baseui/toast";

import {
  HeaderNavigation,
  ALIGN,
  StyledNavigationList,
  StyledNavigationItem,
} from "baseui/header-navigation";
import {
  DisplayLarge,
  DisplayMedium,
  DisplaySmall,
  DisplayXSmall,
  HeadingXXLarge,
  HeadingXLarge,
  HeadingLarge,
  HeadingMedium,
  HeadingSmall,
  HeadingXSmall,
  LabelLarge,
  LabelMedium,
  LabelSmall,
  LabelXSmall,
  ParagraphLarge,
  ParagraphMedium,
  ParagraphSmall,
  ParagraphXSmall,
  Caption1,
  Caption2,
} from 'baseui/typography';
// import {FlexGrid, FlexGridItem} from 'baseui/flex-grid';
// import {Grid, Cell} from 'baseui/layout-grid'; //NOT meant for items -- meant for site layout
import {
  Card,
  StyledBody,
  StyledAction
} from "baseui/card";

// Data generation stuff
import Sentencer from "sentencer"
import UsernameGenerator from "username-generator"
import { decode } from "blurhash"
import Faker from "faker"
import RandomGen from "random-seed"

class Datastore {

  listingCache = {}
  userCache = {}
  imageCache = {}
  apparatusGenerator = new ApparatusGenerator()

  hashCode(str) {
    return Array.from(String(str))
      .reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0)
  }

  generateRandomUsername(id) {
    // var name = Sentencer.make("{{ noun }}")
    Faker.seed(this.hashCode(id))
    name = Faker.internet.userName()
    return name
  }

  generateRandomBlurredImageData(id, width, height) {
    if (id in this.imageCache) {
      return this.imageCache[id]
    }
    console.log("generating")

    var randomGen = RandomGen.create(this.hashCode(id))
    var res = 4
    var blurhashEncoding = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~"
    var randomBlurhash = [...Array(6+(res*res-1)*2).keys()].map(i => Math.floor(blurhashEncoding.length * randomGen.random())).map(i => blurhashEncoding[i])
    randomBlurhash[0] = blurhashEncoding[(res-1) + (res-1)*9]
    randomBlurhash = randomBlurhash.join("")
    const pixels = decode(randomBlurhash, width, height);

    this.imageCache[id] = pixels
    return pixels
  }

  generateRandomApparatus(targetCanvas, seed) {
    this.apparatusGenerator.generateAndCopy({targetCanvas, seed})
  }

  getListingDataById(id) {
    if (id in this.listingCache) {
      return this.listingCache[id]
    }

    const price = Math.round(Math.random()*100)/100
    var name = Sentencer.make("{{ adjective }} {{ noun }}")
    name = name[0].toUpperCase() + name.slice(1, name.length)
    const ownerId = id

    const worldSize = new Vector3(17, 17, 17)
    var gen = (new WorldGenerator({worldSize})).worldWithPlate()
    var range = [...Array(Math.floor(Math.random()*5)+3)]
    range.forEach(() => gen.randomRectangularPrism())
    const blocks = gen.blocks

    const data = {price, name, ownerId, blocks}
    this.listingCache[id] = data
    return data
  }


  getUserDataById(id) {
    if (id in this.userCache) {
      return this.userCache[id]
    }

    const name = this.generateRandomUsername(id)
    Faker.seed(0)
    const avatarURL = Faker.image.avatar()

    var data = {name, avatarURL}
    this.userCache[id] = data
    return data
  }

}

class App extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      web3: null, //if non null, user is "signed in"
      userAddress: null,
    }
  }

  componentDidMount() {
  }

  async signIn() {
    if (!window.ethereum) {
      toaster.warning(`Please use a Web3 client like Metamask`)
      return
    }
    var web3 = new Web3(window.ethereum)
    try {
      await window.ethereum.enable()
      var networkType = await web3.eth.net.getNetworkType()
      if (networkType != "main") {
        toaster.warning(`Client on ${networkType}, please switch to Mainnet`)
      } else {
        var accounts = await web3.eth.getAccounts()
        var userAddress = accounts[0]
        this.setState({web3, userAddress})
      }
    } catch (error) {
      console.log(error)
      toaster.warning("Web3 permission was not granted")
    }
  }

  render() {
    return (
      <div style={{display: "flex", flexDirection: "column", height: "100%"}}>
        <ToasterContainer autoHideDuration={3000} />
        <div>
          <Header signIn={() => this.signIn()} address={this.state.userAddress} />
        </div>
        <div style={{flex: "auto", position: "relative"}}>
          <div style={{position: "absolute", top: "0", left: "0", bottom: "0", right: "0"}}>
            <Router>
              <LandingPage path="/"/>
              <Listings path="/home"/>
              <Listing path="/item/:id"/>
              <VoxelEditor path="/newItem"/>
            </Router>
          </div>
        </div>
      </div>
    )
  }
}

class Listings extends React.Component {

  sideMargins = THEME.sizing.scale1000
  topBottomMargins = THEME.sizing.scale1000

  constructor(props) {
    super(props)

    this.voxelRenderer = new VoxelRenderer({pixelRatio:window.devicePixelRatio})
    this.containerRef = React.createRef()
  }

  componentDidMount() {
    this.containerRef.current.scrollTop = 10000
  }

  componentWillUnmount() {
    this.voxelRenderer.destroy()
  }

  render() {
    var cards = [...Array(40).keys()].map(idx => {
      return (
        <div style={{marginRight: this.sideMargins, marginBottom: this.topBottomMargins}} key={idx} >
          <ListingCard id={idx} voxelRenderer={this.voxelRenderer} />
        </div>
      )
    })

    var hiddenSpacers = [...Array(5).keys()].map(idx => {
      return (
        <div style={{marginRight: this.sideMargins, maxHeight:"0", visibility: "hidden", overflow: "hidden"}} key={idx+"sp"} >
          <ListingCard id={idx} isSpacer={true} />
        </div>
      )
    })

    return (
      <div style={{width: "100%", height: "100%", overflow: "auto", }} ref={this.containerRef}>
        <div style={{display: "flex", justifyContent: "center", alignItems: "start", flexWrap: "wrap", marginLeft: this.sideMargins, marginTop: this.topBottomMargins, maxWidth: "800px"}}>
          {cards}
          {hiddenSpacers}
        </div>
      </div>
    )
  }
}

class ListingCard extends React.Component {

  // imageSize = 200
  imageSize = 200

  constructor(props) {
    super(props)
    this.canvasRef = React.createRef()
  }

  componentDidMount() {
    if (this.props.isSpacer) {return}
    this.updateBlockDisplay()
  }

  componentDidUpdate() {
    if (this.props.isSpacer) {return}
    this.cleanupBlockDisplay()
    this.updateBlockDisplay()
    //ANY prop change will cause block display to fully update. also, listeners not removed
  }

  updateBlockDisplay() {

    this.blockDisplayListeners = []
    var addEventListener = (obj, eventName, func) => {
      this.blockDisplayListeners.push([obj, eventName, func])
      obj.addEventListener(eventName, func)
    }

    var {blocks} = datastore.getListingDataById(this.props.id)

    var gameState = new GameState({blocks})

    const lookAtPos = new Vector3(gameState.worldSize.x/2, 10, gameState.worldSize.y/2)
    var orbiter = new AutomaticOrbiter(gameState.camera, {center: lookAtPos.clone(), height: 8, period: 10, radius: 1.2*gameState.worldSize.x/2, lookAtPos})
    orbiter.setRotationToTime(0)
    this.renderID = this.props.voxelRenderer.addTarget({gameState: gameState, element: this.canvasRef.current})

    // Orbiting
    var timeElapsed = 0
    addEventListener(this.canvasRef.current, "mouseover", e => {
      var lastTimestamp = window.performance.now()
      var tick = timestamp => {
        this.props.voxelRenderer.renderQueue.unshift(this.renderID)
        timeElapsed += (timestamp - lastTimestamp) / 1000
        lastTimestamp = timestamp
        orbiter.setRotationToTime(timeElapsed)
        this.animationFrameRequestID = window.requestAnimationFrame(tick)
      }
      this.animationFrameRequestID = window.requestAnimationFrame(tick)
    })
    addEventListener(this.canvasRef.current, "mouseleave", e => {
      window.cancelAnimationFrame(this.animationFrameRequestID)
    })
  }

  cleanupBlockDisplay() {
    this.blockDisplayListeners.map(([obj, eventName, func]) => obj.removeEventListener(eventName, func))
    window.cancelAnimationFrame(this.animationFrameRequestID)
    this.props.voxelRenderer.removeTarget(this.renderID)
  }

  componentWillUnmount() {
    if (this.props.isSpacer) {return}
    this.cleanupBlockDisplay()
  }

  render() {
    const { price, name } = datastore.getListingDataById(this.props.id)

    return (
      <RouterLink to={`/item/${this.props.id}`}>
      <div style={{boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", overflow: "hidden", cursor: "pointer", backfaceVisibility: "hidden", position: "relative", zIndex: "1"}}>
        <div style={{height: this.imageSize+"px", width: this.imageSize+"px", position: "relative", backgroundColor: "eee"}}>
          <div style={{position: "absolute", right: "10px", top: "10px"}}>
            <UserAvatar id={this.props.id} size={35} />
          </div>
          <canvas ref={this.canvasRef} style={{width: "100%", height: "100%"}} width={this.imageSize} height={this.imageSize}></canvas>
        </div>
        <div style={{width: this.imageSize+"px", height: "1px", backgroundColor: "#efefef"}}></div>
        <div style={{display: "flex", flexDirection: "column", justifyContent: "center", padding: "10px", width: this.imageSize+"px", boxSizing: "border-box"}}>
          <LabelLarge style={{textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden"}}>
            {name}
          </LabelLarge>
          <LabelSmall style={{margin: 0, textAlign: "right", marginTop: "5px"}} color={["contentSecondary"]}>
            {price + " ETH"}
          </LabelSmall>
        </div>
      </div>
      </RouterLink>
    )
  }
}

var AvatarAndName = props => {
  var {labelColor, labelStyle, ownerId, name} = props
  return (
    <RouterLink to={`/user/${ownerId}`}>
      <div style={{display: "flex", alignItems: "center"}}>
        <div style={{paddingRight: "10px", paddingLeft: "10px"}}>
          <UserAvatar size={35} id={ownerId}/>
        </div>
        <LabelLarge color={[labelColor]} style={labelStyle || {}}>
          {name}
        </LabelLarge>
      </div>
    </RouterLink>
  )
}

class UserAvatar extends React.Component {
  constructor(props) {
    super(props)
    this.canvasRef = React.createRef()
  }

  componentDidMount() {
    var {width, height} = this.canvasRef.current.getBoundingClientRect()
    this.canvasRef.current.width = width * window.devicePixelRatio
    this.canvasRef.current.height = height * window.devicePixelRatio
    datastore.generateRandomApparatus(this.canvasRef.current, this.props.id)
    // random blurred image data
    // const sizeX = this.props.size // * window.devicePixelRatio
    // const sizeY = this.props.size //* window.devicePixelRatio
    // const pixels = datastore.generateRandomBlurredImageData(this.props.id, sizeX, sizeY)
    // const canvas = this.canvasRef.current
    // canvas.width = sizeX
    // canvas.height = sizeY
    // const ctx = canvas.getContext("2d");
    // const imageData = ctx.createImageData(sizeX, sizeY);
    // imageData.data.set(pixels);
    // ctx.putImageData(imageData, 0, 0);
  }

  render() {
    var onClick = (e => {
      e.stopPropagation(); navigate(`/user/${this.props.id}`)
    })

    const { avatarURL } = datastore.getUserDataById(this.props.id)

    return (
      <div onClick={onClick} style={{height: this.props.size+"px", width: this.props.size+"px", borderRadius: this.props.size/2.0+"px", backgroundColor: "#eee", cursor: "pointer", overflow: "hidden", boxShadow: "0px 0px 3px #ccc"}}>
        <canvas ref={this.canvasRef} style={{height: "100%", width: "100%"}}/>
      </div>
    )
  }
}

class Listing extends React.Component {

  viewAreaSize = 500
  blockMargins = 40

  constructor(props) {
    super(props)
    this.canvasRef = React.createRef()
  }

  componentDidMount() {
    this.voxelRenderer = new VoxelRenderer({pixelRatio:1, canvas:this.canvasRef.current})
    this.updateBlockDisplay()
  }

  // will update blocks even if blocks/props.id doesn't change
  componentDidUpdate() {
    this.cleanupBlockDisplay()
    this.updateBlockDisplay()
  }

  updateBlockDisplay() {
    const {blocks} = datastore.getListingDataById(this.props.id)
    var gameState = new GameState({blocks})
    var flyControls = new FlyControls({gameState, domElement: this.canvasRef.current,interactionDisabled: true})

    // set initial position
    const lookAtPos = new Vector3(gameState.worldSize.x/2, 10, gameState.worldSize.y/2)
    var orbiter = new AutomaticOrbiter(gameState.camera, {center: lookAtPos.clone(), height: 8, period: 10, radius: 1.2*gameState.worldSize.x/2, lookAtPos})
    orbiter.setRotationToTime(0)

    this.renderID = this.voxelRenderer.addTarget({gameState: gameState, element: this.canvasRef.current})

    var tick = timestamp => {
      this.voxelRenderer.renderQueue.unshift(this.renderID)
      flyControls.externalTick(1/60)
      this.animationFrameRequestID = window.requestAnimationFrame(tick)
    }
    this.animationFrameRequestID = window.requestAnimationFrame(tick)
  }

  cleanupBlockDisplay() {
    window.cancelAnimationFrame(this.animationFrameRequestID)
    this.voxelRenderer.removeTarget(this.renderID)
  }

  componentWillUnmount() {
    this.cleanupBlockDisplay()
    this.voxelRenderer.destroy()
  }

  render() {
    const { price, name, ownerId } = datastore.getListingDataById(this.props.id)
    const owner = datastore.getUserDataById(ownerId)

    return (
        <div style={{display: "flex", justifyContent: "center", alignItems: "center", padding: "20px"}}>
          <div style={{display: "flex", flexWrap: "wrap"}}>
            <div style={{width: this.viewAreaSize+"px", height: this.viewAreaSize+"px", boxShadow: "0px 1px 2px #ccc", borderRadius: "20px", overflow: "hidden", backgroundColor: "#ccc", margin: this.blockMargins+"px", position: "relative", zIndex: "1"}}>
              <div style={{position: "absolute", top:"10px", right: "10px"}}>
                <ControlsHelpTooltip hideEditControls/>
              </div>
              <canvas ref={this.canvasRef} style={{height: "100%", width: "100%"}}/>
            </div>
            <div style={{width: this.viewAreaSize+"px", maxWidth: this.viewAreaSize + "px", display: "flex", flexDirection: "column", margin: this.blockMargins+"px"}}>
              <DisplaySmall color={["colorSecondary"]}>
                {name}
              </DisplaySmall>
                <div style={{display: "flex", marginTop: "10px", alignItems: "center", paddingLeft: "2px"}}>
                  <LabelLarge color={["colorSecondary"]}>
                    {"Owned by"}
                  </LabelLarge>
                  <AvatarAndName ownerId={ownerId} name={owner.name} labelColor={"colorSecondary"} />
                </div>
            </div>
          </div>
        </div>
    )
  }
}

class LandingPage extends React.Component {
  constructor(props) {
    super(props)
  }

  render() {
    return "you've landed"
  }
}

class Header extends React.Component {
  constructor(props) {
    super(props)
  }

  render() {
    var searchBefore = (
      <div style={{display: 'flex', alignItems: 'center', paddingLeft: THEME.sizing.scale500}}>
        <Search size="18px" />
      </div>)
    var searchBar = (
      <Input
        overrides={{Before: () => searchBefore}}
        onChange={() => this.props.search}
        placeholder={"search"}>
      </Input>)
    var onSearchSubmit = e => {
      e.preventDefault()
    }

    var profileArea
    if (this.props.address) {
      profileArea = <AvatarAndName ownerId={this.props.address} name={this.props.address} labelColor={"colorPrimary"} labelStyle={{maxWidth: "150px", textOverflow: "ellipsis", overflow: "hidden"}}/>
    } else {
      profileArea = (
        <Button onClick={this.props.signIn}>Sign In</Button>
      )
    }

    return (
      <HeaderNavigation style={{backgroundColor: "white"}}>
        <StyledNavigationList $align={ALIGN.left}>
          <StyledNavigationItem>
            <RouterLink to={"/"} >
              <DisplayMedium
                style={{userSelect: "none", cursor: "pointer", paddingLeft: "0"}}>
                Polytope
              </DisplayMedium>
            </RouterLink>
          </StyledNavigationItem>
        </StyledNavigationList>
        <StyledNavigationList $align={ALIGN.center}>
          <StyledNavigationItem style={{width: "100%",  minWidth: "200px", maxWidth: "600px"}}>
            <form onSubmit={() => onSearchSubmit} style={{margin:"0"}}>
              {searchBar}
            </form>
          </StyledNavigationItem>
        </StyledNavigationList>
        <StyledNavigationList $align={ALIGN.right}>
          <StyledNavigationItem style={{paddingLeft: "0px"}}>
            <RouterLink to={"/home"}>
              <Button kind={KIND.minimal} size={SIZE.default}>
                Home
              </Button>
            </RouterLink>
          </StyledNavigationItem>
          <StyledNavigationItem style={{paddingLeft: "0"}}>
            <RouterLink to={"/newItem"}>
            <Button kind={KIND.minimal} size={SIZE.default}>
              Create Item
            </Button>
            </RouterLink>
          </StyledNavigationItem>
        </StyledNavigationList>
        <StyledNavigationList $align={ALIGN.right} style={{marginRight: "20px"}}>
          <StyledNavigationItem>
            {profileArea}
          </StyledNavigationItem>
        </StyledNavigationList>
      </HeaderNavigation>
    )
  }
}


var RouterLink = props => {
  var unstyledLink = <RawRouterLink {...props} style={{textDecoration: "none"}}>
    {props.children}
  </RawRouterLink>
  return unstyledLink
}

const THEME = LightTheme
const engine = new Styletron();
const datastore = new Datastore();

ReactDOM.render((
	<StyletronProvider value={engine}>
		<BaseProvider theme={THEME}>
			<App/>
		</BaseProvider>
	</StyletronProvider>
), document.getElementById('root'));
