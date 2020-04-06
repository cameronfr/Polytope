// React / babel stuff
var React = require("react")
var ReactDOM = require("react-dom")
import { Router, Link as RawRouterLink, navigate, Redirect} from "@reach/router"
import "regenerator-runtime/runtime";

// Web3 stuff
// var Web3 = require("web3");
var Web3Eth = require('web3-eth');
var Web3Utils = require('web3-utils');
import { Keccak } from "sha3"
import { Buffer } from "buffer"

// Voxel Stuff
import {ApparatusGenerator} from "./procedural.jsx"
import Stats from "stats.js"
import {Vector3, PerspectiveCamera, Box3} from 'three';
import Regl from "regl"
import ndarray from "ndarray"
import mat4 from "gl-mat4"
import np from "ndarray-ops"

// Baseweb UI stuff
const CopyToClipboard = require('clipboard-copy')
import {Provider as StyletronProvider} from 'styletron-react';
import {Client as Styletron} from 'styletron-engine-atomic';
import {useStyletron} from 'baseui';
import {LightTheme, BaseProvider, styled} from 'baseui';
import { StyledLink } from "baseui/link";
import { Button, KIND, SIZE } from "baseui/button";
import { Input as InputBroken } from "baseui/input"
import { Search } from "baseui/icon";
import { Notification, KIND as NotificationKind} from "baseui/notification";
import { toaster, ToasterContainer } from "baseui/toast";
import { Checkbox, LABEL_PLACEMENT } from "baseui/checkbox";
import { StatefulTooltip } from "baseui/tooltip";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "baseui/icon"
import { MdMouse } from "react-icons/md"
import {IoMdHelpCircleOutline, IoMdHelp} from "react-icons/io"
import { Navigation } from "baseui/side-navigation";
import { Spinner } from "baseui/spinner";

// Web3 imports
import BigNumber from "bignumber.js"

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
import RandomGen from "random-seed"

var APIEndpoint = "https://app.polytope.space"
if (process.env.NODE_ENV == "development") {
  APIEndpoint = "http://localhost:5000"
}


class Datastore {

  cache = {
    user: {},
    item: {},
  }
  pendingEndpointCalls= {
    user: {},
    item: {},
  }

  subscriptionCounter = 0

  apparatusGenerator = new ApparatusGenerator()

  nullType = {
    "user": {name: null, avatarURL: null},
    "item": {price: null, name: null, description: null, notForSale: null, authorId: null, ownerId: null}
  }

  hashCode(str) {
    return Array.from(String(str))
      .reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0)
  }

  generateUsername() {
    var processIt = str => {
      str = Sentencer.make(str)
      if (str && Math.random() < 0.3) {
        str = str[0].toUpperCase() + str.slice(1, str.length)
      }
      return str
    }

    var parts = []
    parts.push(`${Math.random() < 0.3 ? "{{adjective}}" : ""}`)
    parts.push(`{{noun}}`)
    parts.push(`${Math.random() < 0.5 ? ".{{noun}}" : ""}`)
    parts.push(`${Math.random() < 0.4 ? (Math.random()*100).toFixed(0) : ""}`)

    return parts.map(p => processIt(p)).join("")
  }

  generateBlurredImageData(id, width, height) {
    if (id in this.imageCache) {
      return this.imageCache[id]
    }

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

  generateApparatus(targetCanvas, seed) {
    this.apparatusGenerator.generateAndCopy({targetCanvas, seed})
  }

  async getData({id, kind, overrideCache}) {
    id = id.toLowerCase()
    if ((id in this.cache[kind]) && (this.cache[kind][id].data) && !overrideCache) {
      return this.cache[kind][id].data
    }

    var data
    var generatedData
    if (id in this.pendingEndpointCalls[kind]) {
      res = await this.pendingEndpointCalls[kind][id]
    }
    if (kind == "user") {
      var call = this.callEndpoint("/getUserData", [id], "POST").then(res => res.json())
      this.pendingEndpointCalls[kind][id] = call
      var res = await call
      data = res[id]
      generatedData = this.generateUserData({id})
    } else if (kind == "item") {
      var res = {id: null}
      data = res[id]
      generatedData = this.generateItemData({id})
    }
    delete this.pendingEndpointCalls[kind][id]
    data = {...generatedData, ...data}

    this.cache[kind][id] = this.cache[kind][id] || {data: null, subscribers: {}}
    this.cache[kind][id].data = data
    Object.values(this.cache[kind][id].subscribers).forEach(callback => callback(data))
    return data
  }

  generateItemData({id}) {

    const price = Math.round(Math.random()*100)/100
    var name = Sentencer.make("{{ adjective }} {{ noun }}")
    name = name[0].toUpperCase() + name.slice(1, name.length)
    const ownerId = Web3Utils.sha3(id.toString()).slice(0, 42)

    const worldSize = new Vector3(17, 17, 17)
    var gen = (new WorldGenerator({worldSize}))//.worldWithPlate()
    var range = [...Array(Math.floor(Math.random()*5)+3)]
    range.forEach(() => gen.randomRectangularPrism())
    const blocks = gen.blocks

    var description = Sentencer.make([...Array(Math.floor(Math.random()*15))].map(i => "{{noun}}").join(" "))

    var authorId = id+10

    const data = {price, name, ownerId, blocks, description, authorId}
    return data
  }

  generateUserData({id}) {
    var name = this.generateUsername(id)
    const avatarURL = undefined
    return {name, avatarURL}
  }

  addSubscription({id, kind, callback}) {
    id = id.toLowerCase()
    this.subscriptionCounter += 1
    const subscriptionId = this.subscriptionCounter
    this.cache[kind][id] = this.cache[kind][id] || {data: undefined, subscribers: {}}
    this.cache[kind][id].subscribers[subscriptionId] = callback
    return subscriptionId
  }

  removeSubscription({id, kind, subscriptionId}) {
    id = id.toLowerCase()
    delete this.cache[kind][id].subscribers[subscriptionId]
  }

  // async getUserDataBatch(ids) {
  //   var res = await this.callEndpoint("/getUserData", ids, "POST").json()
  //   var users = {}
  //   ids.map(id => {
  //     const name = (res[id] && res[id].name) || this.generateRandomUsername(id)
  //     const avatarURL = undefined
  //     var data = {name, avatarURL}
  //     users[id] = data
  //     this.cache.user[id] = data
  //   })
  //   return users
  // }

  async callEndpoint(endpointFunction, dataDict, method) {
    var res = await fetch(APIEndpoint+endpointFunction, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataDict)
    })
    return res
  }

  async setUserData(messageData) {
    const {id, message, signature} = messageData //assertion of sorts
    var res = await this.callEndpoint("/setUserSettings", messageData, "POST") //will error if fails
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
      toaster.warning(`A web3 client such as Metamask is required.`)
      return
    }
    var web3 = {}
    web3.eth = new Web3Eth(window.ethereum)
    try {
      await window.ethereum.enable()
      var networkType = await web3.eth.net.getNetworkType()
      if (networkType != "main") {
        toaster.warning(`Client on ${networkType}, please switch to Mainnet.`)
      } else {
        var accounts = await web3.eth.getAccounts()
        var userAddress = accounts[0]
        this.setState({web3, userAddress})
      }
    } catch (error) {
      console.log(error)
      toaster.warning("Web3 permission was not granted.")
    }
  }

  render() {
    var {userAddress, web3} = this.state
    var web3Data = {userAddress, web3}
    return (
      <div style={{display: "grid", gridTemplateRows: "auto 1fr", height: "100%", minWidth: "1000px"}}>
        <ToasterContainer autoHideDuration={3000} overrides={{Root: {style: () => ({zIndex: 2})}}}/>
        <div>
          <Header signIn={() => this.signIn()} address={this.state.userAddress} />
        </div>
        <Router style={{height: "100%"}}>
          <SidebarAndListings path="/home"/>
          <UserProfile web3Data={web3Data} path="/user/:id"/>
        </Router>
        <div style={{flex: "auto", position: "relative"}}>
          <div style={{position: "absolute", top: "0", left: "0", bottom: "0", right: "0"}}>
            <Router primary={false}>
              <LandingPage path="/"/>
              <Listing path="/item/:id"/>
              <VoxelEditor path="/newItem"/>
            </Router>
          </div>
        </div>
      </div>
    )
  }
}

var SidebarAndListings = props => {
  const sidebarItems = [
    {title: "Cheap"},
    {title: "New"},
    {title: "Old"},
    {title: "Popular"},
    {title: "Expensive"},
  ]
  const navigationItems = sidebarItems.map(({title}) => ({title, itemId: "#"+title.toLowerCase()}))

  const [activeSidebarId, setActiveSidebarId] = React.useState()

  React.useEffect(() => {
    const defaultSidebarId = "#popular"
    const newSidebarId = navigationItems.map(item => item.itemId).includes(props.location.hash) ? props.location.hash : defaultSidebarId
    setActiveSidebarId(newSidebarId)
  })
  var onChange = ({event, item}) => {
    event.preventDefault()
    navigate(item.itemId)
  }
  return <div style={{display: "grid", gridTemplateColumns: "auto 1fr", height: "100%"}}>
    <div style={{width: "200px", marginLeft: THEME.sizing.scale1400, marginTop: THEME.sizing.scale1400, boxSizing: "border-box"}}>
      <Navigation items={navigationItems} activeItemId={activeSidebarId} onChange={onChange}/>
    </div>
    <div style={{position: "relative"}}>
      <div style={{position: "absolute", top: "0", left: "0", bottom: "0", right: "0", overflow: "auto"}}>
        <Listings />
      </div>
    </div>
  </div>

}

var UserProfile = props => {
  var canvasRef = React.useRef()
  const id = props.id
  var [name, setName] = React.useState()
  var resetName = async () => {console.log((await datastore.getData({id, kind:"user"})));setName((await datastore.getData({id, kind:"user"})).name)}

  React.useEffect(() => {
    resetName()

    // setting canvas picture
    var {width, height} = canvasRef.current.getBoundingClientRect()
    canvasRef.current.width = width * window.devicePixelRatio
    canvasRef.current.height = height * window.devicePixelRatio
    datastore.generateApparatus(canvasRef.current, props.id)
  }, [props.id])

  const profilePicSize = 200

  const [isEditing, setIsEditing] = React.useState(false)
  var editButton = null
  if (props.web3Data.userAddress == id) {
    editButton = <Caption2 onClick={() => setIsEditing(true)}style={{marginLeft: "4px", textDecoration:"underline", lineHeight: "24px", cursor:"pointer"}}>edit</Caption2>
  }

  var displayHtml = <>
    <div style={{display: "grid", gridTemplateColumns: "repeat(2, minmax(auto, min-content))", justifyContent: "center", alignItems: "end"}} >
      <HeadingSmall style={{margin: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
        {name}
      </HeadingSmall>
      {editButton}
    </div>
  </>

  var caption = (text, errorText, isError) => <>
      <Caption1 color={isError ? ["negative400"] : undefined} style={{textAlign: "left"}}>
        {isError ? errorText : text}
      </Caption1>
    </>

  const [email, setEmail] = React.useState("")
  const [waiting, setWaiting] = React.useState("")
  const [notification, setNotification] = React.useState("")
  var emailRegex = (/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)
  var emailValid = emailRegex.test(email)

  var reset = async () => {
    resetName()
    setIsEditing(false)
    setNotification("")
  }
  var submit = async () => {
    var web3 = props.web3Data.web3
    var validUntil = Math.floor(Date.now()/1000) + 120
    var signature
    var message = `I'm updating my preferences on Polytope with the username ${name} and the email ${email}. This request is valid until ${validUntil}`
    setNotification("")
    try {
      setWaiting("Waiting for signature")
      signature = await web3.eth.personal.sign(Web3Utils.fromUtf8(message), id);
    } catch(e) {
      console.log(e)
      setNotification("Signature was not given")
      setWaiting("")
      return
    }
    try {
      setWaiting("Uploading to server")
      await datastore.setUserData({message, id, signature})
      setWaiting("Setting name")
      setName((await datastore.getData({id, kind: "user", overrideCache: true})).name)
      setIsEditing(false)
      setWaiting("")
    } catch (e) {
      console.log(e)
      setNotification("Upload to server failed")
      setWaiting("")
      return
    }
  }
  var notificationHtml = notification ? <Notification kind={NotificationKind.warning} overrides={{Body: {style: {width: 'auto'}}}}>{() => notification}</Notification> : null
  var editHtml = <>
    <div>
      {notificationHtml}
      {caption("Edit your username (required)", "Can't be empty", !name)}
      <Input size={SIZE.compact} placeholder={"username"} value={name} onChange={e => setName(e.target.value)} error={!name}/>
      {caption("Edit your email (won't be shown)", "Invalid email", email && !emailValid)}
      <Input size={SIZE.compact} placeholder={"e.g. email@my.com"} value={email} onChange={e => setEmail(e.target.value)} error={email && !emailValid}/>
    </div>
    <div style={{display: "grid", gridTemplateColumns: "auto auto", columnGap: "15px"}}>
      <Button kind={KIND.secondary} size={SIZE.compact} onClick={reset}>Cancel</Button>
      <Button kind={KIND.primary} size={SIZE.compact} onClick={submit}>Submit</Button>
    </div>
  </>
  var waitingHtml = <>
    <div>
      <Spinner />
    </div>
    <LabelSmall>{waiting}</LabelSmall>
  </>

  return <div style={{display: "grid", gridTemplateColumns: "auto 1fr", height: "100%"}}>
    <div style={{width: "200px", marginLeft: THEME.sizing.scale1400, marginTop: THEME.sizing.scale1400}}>
      <div style={{display: "grid", gridTemplateColumns: "auto", textAlign:"center", rowGap: "15px"}}>
        <canvas ref={canvasRef} style={{height: profilePicSize+"px", width: profilePicSize+"px", borderRadius: (profilePicSize/2)+"px", boxShadow: "0px 0px 5px #ccc", backgroundColor: "#eee"}}/>
        {isEditing ? (waiting ? waitingHtml : editHtml) : displayHtml}
        <LabelSmall style={{overflow: "auto"}} color={["contentSecondary"]}>
          {id}
        </LabelSmall>
      </div>
    </div>
    <div style={{position: "relative"}}>
      <div style={{position: "absolute", top: "0", left: "0", bottom: "0", right: "0", overflow: "auto"}}>
        <Listings />
      </div>
    </div>
  </div>

}

class Listings extends React.Component {

  cardGap = THEME.sizing.scale1000
  sidesGap = THEME.sizing.scale1400

  constructor(props) {
    super(props)

    this.voxelRenderer = new VoxelRenderer({pixelRatio:window.devicePixelRatio})
    this.containerRef = React.createRef()
  }

  componentDidMount() {
    // this.containerRef.current.scrollTop = 10000
  }

  componentWillUnmount() {
    this.voxelRenderer.destroy()
  }

  render() {
    var cards = [...Array(10).keys()].map(idx => {
      var itemId = Web3Utils.sha3(idx.toString())
      var card = <ListingCard key={idx} id={itemId} voxelRenderer={this.voxelRenderer} imageSize={220} />
      return card
    })

    return (
      <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, 220px)", justifyContent: "center", rowGap: this.cardGap, columnGap: this.cardGap, maxWidth: "1100px", margin: this.sidesGap}}>
        {cards}
      </div>
    )
  }
}

var ListingCard = props => {
  const canvasRef = React.useRef()
  const imageSize =

  React.useEffect(() => {
    var blockDisplayListeners = []
    var addEventListener = (obj, eventName, func) => {
      blockDisplayListeners.push([obj, eventName, func])
      obj.addEventListener(eventName, func)
    }
    var renderId
    var animationFrameRequestId

    var setupBlockdisplay = async () => {
      var {blocks} = props.listingData || (await datastore.getData({id: props.id, kind:"item"}))

      var gameState = new GameState({blocks})
      const lookAtPos = new Vector3(gameState.worldSize.x/2, 10, gameState.worldSize.y/2)
      var orbiter = new AutomaticOrbiter(gameState.camera, {center: lookAtPos.clone(), height: 8, period: 10, radius: 1.2*gameState.worldSize.x/2, lookAtPos})
      orbiter.setRotationToTime(0)
      renderId = props.voxelRenderer.addTarget({gameState: gameState, element: canvasRef.current})

      // Orbiting
      var timeElapsed = 0
      var enableRotation = () => {
        var lastTimestamp = window.performance.now()
        var tick = timestamp => {
          props.voxelRenderer.renderQueue.unshift(renderId)
          timeElapsed += (timestamp - lastTimestamp) / 1000
          lastTimestamp = timestamp
          orbiter.setRotationToTime(timeElapsed)
          animationFrameRequestId = window.requestAnimationFrame(tick)
        }
        animationFrameRequestId = window.requestAnimationFrame(tick)
      }
      if (props.autoOrbit) {
        enableRotation()
      } else {
        addEventListener(canvasRef.current, "mouseover", e => enableRotation())
        addEventListener(canvasRef.current, "mouseleave", e => window.cancelAnimationFrame(animationFrameRequestId))
      }
    }
    var cancelBlockDisplay = () => {
      blockDisplayListeners.map(([obj, eventName, func]) => obj.removeEventListener(eventName, func))
      window.cancelAnimationFrame(animationFrameRequestId)
      props.voxelRenderer.removeTarget(renderId)
    }
    setupBlockdisplay()
    return cancelBlockDisplay
  }, [props.id])

  var item = useGetFromDatastore({id: props.id, kind: "item", dontUse: !props.id}) //can't not run a hook
  item = item || props.listingData

  const {price, name, description, notForSale, authorId, ownerId} = item

  var cardInterior = <>
    <canvas ref={canvasRef} style={{height: props.imageSize+"px"}} width={props.imageSize} height={props.imageSize}></canvas>
    <div style={{width: props.imageSize+"px", height: "1px", backgroundColor: "#efefef"}}></div>
    <div style={{display: "flex", flexDirection: "column", justifyContent: "center", padding: "10px", width: props.imageSize+"px", boxSizing: "border-box", backgroundColor: THEME.colors.primaryB}}>
      <LabelLarge style={{textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden"}}>
        {name}
      </LabelLarge>
      <ParagraphSmall color={["colorSecondary"]} style={{whiteSpace: "nowrap", overflow:"hidden", textOverflow: "ellipsis", margin: "5px 0px 0px 0px"}}>
        {description || " "}
      </ParagraphSmall>
      <LabelSmall style={{margin: 0, textAlign: "right", marginTop: "5px"}} color={["contentSecondary"]}>
        {notForSale ? "Not For Sale" : price + " ETH"}
      </LabelSmall>
    </div>
  </>

  var inner
  if (!props.listingData) {
    inner = <RouterLink to={`/item/${props.id}`}>
      {cardInterior}
    </RouterLink>
  } else {
    inner = cardInterior
  }

  return <>
    <div style={{boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", overflow: "hidden", backfaceVisibility: "hidden", position: "relative", zIndex: "1", width: "min-content",/* width: imageSize+"px",*/ position: "relative", backgroundColor: "eee"}}>
      <div style={{position: "absolute", right: "10px", top: "10px"}}>
        <UserAvatar id={ownerId} size={35} />
      </div>
      {inner}
    </div>
  </>
}

var AvatarAndName = props => {

  var [newDataCtr, setNewDataCtr] = React.useState(0)
  var {labelColor, labelStyle, id} = props

  var user = useGetFromDatastore({id, kind:"user"})

  return (
      <div style={{display: "flex", alignItems: "center"}}>
        <div style={{paddingRight: "10px"}}>
          <UserAvatar size={35} id={id}/>
        </div>
        <RouterLink to={`/user/${id}`}>
          <LabelLarge color={[labelColor]} style={labelStyle || {}}>
            {user.name}
          </LabelLarge>
        </RouterLink>
      </div>
  )
}

var UserAvatar = props => {
  const canvasRef = React.useRef()
  var [hover, setHover] = React.useState(false)

  React.useEffect(() => {
    var {width, height} = canvasRef.current.getBoundingClientRect()
    canvasRef.current.width = width * window.devicePixelRatio
    canvasRef.current.height = height * window.devicePixelRatio
    datastore.generateApparatus(canvasRef.current, props.id)
  }, [props.id])

  const {avatarURL} = useGetFromDatastore({id: props.id, kind: "user"})

  var filter = hover ? "brightness(95%)" : ""

  return <>
    <RouterLink to={`/user/${props.id}`}>
      <div style={{height: props.size+"px", width: props.size+"px", borderRadius: props.size/2.0+"px", backgroundColor: "#eee", cursor: "pointer", overflow: "hidden", boxShadow: "0px 0px 3px #ccc", filter}} onMouseOver={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <canvas ref={canvasRef} style={{height: "100%", width: "100%"}}/>
      </div>
    </RouterLink>
  </>
}

var usePromise = (datastoreCall, shouldRun) => {
  const [response, setResponse] = React.useState()
  var isCancelled = false

  React.useEffect(() => {
    var cancel = () => {isCancelled = true}
    return cancel
  }, [shouldRun])

  shouldRun && datastoreCall().then(res => {
    !isCancelled && setResponse(res)
  })

  return response
}

var useGetFromDatastore = ({id, kind, dontUse}) => {
  var [shouldUpdateCounter, setShouldUpdateCounter] = React.useState(0)
  var [response, setResponse] = React.useState(datastore.nullType[kind])

  var isCancelled = false
  var shouldRun = id && true && !dontUse

  shouldRun && datastore.getData({id, kind}).then(res => {
    !isCancelled && setResponse(res)
  })

  React.useEffect(() => {
    if (shouldRun) {
      var cancel = () => {isCancelled = true}
      return cancel
    }
  })

  React.useEffect(() => {
    if (shouldRun) {
      var callback = () => setShouldUpdateCounter(shouldUpdateCounter + 1)
      var subscriptionId = datastore.addSubscription({kind, id, callback})
      var cancel = () => datastore.removeSubscription({kind, id, subscriptionId})
      return cancel
    }
  })

  return dontUse ? null : (response || datastore.nullType[kind])
}

var Listing = props => {
  const viewAreaSize = 500
  const canvasRef = React.useRef()

  // Game setup and destroy
  React.useEffect(() => {
    var animationFrameRequestID
    var renderID
    var voxelRenderer
    var setupGame = async () => {
      voxelRenderer = new VoxelRenderer({pixelRatio:1, canvas:canvasRef.current})
      var {blocks} = await datastore.getData({id: props.id, kind: "item"})
      var gameState = new GameState({blocks})
      var flyControls = new FlyControls({gameState, domElement: canvasRef.current, interactionDisabled: true})

      // set initial position
      const lookAtPos = new Vector3(gameState.worldSize.x/2, 10, gameState.worldSize.y/2)
      var orbiter = new AutomaticOrbiter(gameState.camera, {center: lookAtPos.clone(), height: 8, period: 10, radius: 1.2*gameState.worldSize.x/2, lookAtPos})
      orbiter.setRotationToTime(0)

      renderID = voxelRenderer.addTarget({gameState: gameState, element: canvasRef.current})
      var tick = timestamp => {
        if (document.hasFocus()) {
          voxelRenderer.renderQueue.unshift(renderID)
          flyControls.externalTick(1/60)
        }
        animationFrameRequestID = window.requestAnimationFrame(tick)
      }
      animationFrameRequestID = window.requestAnimationFrame(tick)
    }
    var cleanupGame = () => {
      window.cancelAnimationFrame(animationFrameRequestID)
      voxelRenderer.destroy()
    }
    setupGame()
    return cleanupGame
  }, [props.id])

  var item = useGetFromDatastore({id: props.id, kind: "item"})
  var owner = useGetFromDatastore({id: item && item.ownerId, kind: "user"})
  var author = useGetFromDatastore({id: item && item.authorId, kind: "user"})

  const blockMargins = 28

  return <>
    <div style={{display: "flex", justifyContent: "center", alignItems: "center", padding: "28px"}}>
      <div style={{display: "flex", flexWrap: "wrap"}}>
        {/*TODO: make this accessible */}
        <ArrowLeft size={40} onClick={() => window.history.back()} style={{color: "black", cursor: "pointer", marginTop: blockMargins+"px"}}/>
        <div style={{width: viewAreaSize+"px", height: viewAreaSize+"px", boxShadow: "0px 1px 2px #ccc", borderRadius: "20px", overflow: "hidden", backgroundColor: "#ccc", margin: blockMargins+"px", position: "relative", zIndex: "1"}}>
          <div style={{position: "absolute", top:"10px", right: "10px"}}>
            <ControlsHelpTooltip hideEditControls/>
          </div>
          <canvas ref={canvasRef} style={{height: "100%", width: "100%"}}/>
        </div>
        <div style={{/*width: viewAreaSize+"px",*/flexBasis: "min-content", flexGrow: "1", maxWidth: viewAreaSize + "px", display: "flex", flexDirection: "column", margin: blockMargins+"px"}}>
          <DisplaySmall color={["colorSecondary"]}>
            {item.name}
          </DisplaySmall>
          <div style={{display: "grid", gridTemplateColumns: "repeat(2, min-content)", alignItems: "center", marginTop: "25px", paddingLeft: "2px", rowGap: "20px"}}>
            <LabelLarge color={["colorSecondary"]} style={{marginRight: "10px", whiteSpace: "nowrap"}}>
              {"Owner is"}
            </LabelLarge>
            <AvatarAndName id={item.ownerId} labelColor={"colorSecondary"} />
            <LabelLarge color={["colorSecondary"]} style={{marginRight: "10px", whiteSpace: "nowrap", textAlign: "left"}}>
              {"Maker is"}
            </LabelLarge>
            <AvatarAndName id={item.authorId} labelColor={"colorSecondary"} />
          </div>
          <ParagraphMedium style={{marginTop: "25px", paddingLeft: "2px", lineHeight: "2em"}}>
            {item.description}
          </ParagraphMedium>
        </div>
      </div>
    </div>
  </>
}

var LandingPage = props => {

  var voxelRenderer = new VoxelRenderer({pixelRatio:window.devicePixelRatio})
  React.useEffect(() => {
    return () => voxelRenderer.destroy()
  })


  var cards = [...Array(3).keys()].map(idx => {
    var itemId = Web3Utils.sha3(idx.toString())
    var card = <ListingCard key={idx} id={itemId} voxelRenderer={voxelRenderer} imageSize={220} />
    var container = <div style={{display: "flex", justifyContent: "center"}}>{card}</div>
    return card
  })

  const clipPath = "polygon(0 0, 100% 0, 100% 50%, 0% 100%)"
  return <>
    <div style={{clipPath, WebkitClipPath: clipPath, backgroundColor: "#eee", height: "660px"}}>
      <div style={{height: "500px", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-around"}}>
        {cards}
      </div>
    </div>
  </>
}

var Header = props => {

  var searchBefore = (
    <div style={{display: 'flex', alignItems: 'center', paddingLeft: THEME.sizing.scale500}}>
      <Search size="18px" />
    </div>)
  var searchBar = (
    <Input
      overrides={{Before: () => searchBefore}}
      onChange={() => props.search}
      placeholder={"search"}>
    </Input>)
  var onSearchSubmit = e => {
    e.preventDefault()
  }

  var profileArea
  if (props.address) {
    profileArea = <AvatarAndName id={props.address} labelColor={"colorPrimary"} labelStyle={{maxWidth: "150px", textOverflow: "ellipsis", overflow: "hidden"}}/>
  } else {
    profileArea = <>
      <Button onClick={props.signIn}>Sign In</Button>
    </>
  }

  const farSideMargins = THEME.sizing.scale1400

  return <>
    <HeaderNavigation style={{backgroundColor: "white"}}>
      <StyledNavigationList $align={ALIGN.left} style={{marginLeft: farSideMargins}}>
        <StyledNavigationItem style={{paddingLeft: "0"}}>
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
      <StyledNavigationList $align={ALIGN.right} style={{marginRight: farSideMargins}}>
        <StyledNavigationItem>
          {profileArea}
        </StyledNavigationItem>
      </StyledNavigationList>
    </HeaderNavigation>
  </>
}

var RouterLink = props => {
  var unstyledLink = <RawRouterLink {...props} style={{textDecoration: "none"}}>
    {props.children}
  </RawRouterLink>
  return unstyledLink
}

// baseweb input onKeyDown is broken. this will break forms
var Input = props => {
  var eventCapturingInput  = <div>
    <InputBroken {...props} onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()} onKeyPress={e => e.stopPropagation()} />
  </div>
  return eventCapturingInput
}

//Sphere optimization possible todo: https://medium.com/@calebleak/raymarching-voxel-rendering-58018201d9d6
//TODO: regl on context loss so stuff doesn't randomly blank
//TODO: if want larger worlds (e.g. 128^3), texture transfer becomes bottleneck => use .subimage to update GPU block data

class VoxelRenderer {
  constructor(options) {
    if (!options.canvas) {
      this.canvas = document.createElement('canvas')
      this.canvas.style.cssText ="position: absolute; top:0; left:0; height: 10; width:10px;" //chrome behavior: copying via ctx.drawimage won't work correctly unless canvas has size
      this.canvas.style.zIndex ="-1"
      document.body.appendChild(this.canvas);
    } else {
      this.canvas = options.canvas
    }
    this.pixelRatio = options.pixelRatio || 1

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
      uniform vec3 worldSize;
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
        if (clamp(index, vec3(0, 0, 0), worldSize - 1.0) == index) {
          vec2 blockIdxs = vec2(index.x,index.y*worldSize.z + index.z);
          vec4 blockValue = texture2DLodEXT(blocks, blockIdxs/vec2(worldSize.x, worldSize.y*worldSize.z), 0.0);
          return blockValue;
        } else {
           return vec4(0, 0, 0, -1); //so a=-1 means out of bounds, a=0 means blank block
         }
      }

      // Slower
      // vec4 raymarchToBlockNoBranching(vec3 startPos, vec3 rayDir, out vec3 blockIdx, out vec3 hitPos) {
      //   vec3 edge;
      //   vec4 blockValue = vec4(0, 0, 0, 0);
      //   vec3 outRayPos;
      //
      //   const float eps = 0.0001;
      //   float t = 0.0;
      //   for(int i=0; i<maxRaymarchSteps; i++) {
      //     vec3 rayPos = startPos + rayDir * t;
      //
      //     bool inWorld = clamp(rayPos, 0.0, float(worldSize) - 0.0000000001) == rayPos;
      //     vec3 possibleEdge = vec3(floor(rayPos.x), floor(rayPos.y), floor(rayPos.z));
      //     vec4 possibleBlock = blockValueAtIndex(possibleEdge);
      //     float shouldUpdateOutputs = float(inWorld && possibleBlock.a != 0.0 && blockValue.a == 0.0);
      //
      //     edge = shouldUpdateOutputs * possibleEdge + (1.0-shouldUpdateOutputs) * edge;
      //     blockValue = shouldUpdateOutputs * possibleBlock + (1.0-shouldUpdateOutputs) * blockValue;
      //     outRayPos = shouldUpdateOutputs * rayPos + (1.0-shouldUpdateOutputs) * outRayPos;
      //
      //     vec3 distanceToPlanes = step(vec3(0, 0, 0), rayDir)*(1.0 - fract(rayPos)) + (1.0 - step(vec3(0, 0, 0), rayDir))*(fract(rayPos));
      //     vec3 tDeltasToPlanes = distanceToPlanes / abs(rayDir);
      //     t += eps + min(tDeltasToPlanes.x, min(tDeltasToPlanes.y, tDeltasToPlanes.z));
      //   }
      //
      //   hitPos = outRayPos;
      //   blockIdx = edge;
      //   return blockValue;
      // }

      vec4 raymarchToBlock(vec3 startPos, vec3 rayDir, out vec3 blockIdx, out vec3 hitPos) {
        const float eps = 0.00001;
        float t = 0.0;
        for(int i=0; i<maxRaymarchSteps; i++) {
          vec3 rayPos = startPos + rayDir * t;

          vec3 edge = vec3(floor(rayPos.x), floor(rayPos.y), floor(rayPos.z));
          vec4 blockValue = blockValueAtIndex(edge);
          bool isNonBlankBlock = blockValue.a > 0.0;
          // bool isOutOfBoundsBlock = blockValue.a == -1.0;

          if (isNonBlankBlock) {
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
          if (adjacentBlockVal.a > 0.0) {
            float dist = length(abs(sideDirs[i]) * abs(adjacentBlockPos + vec3(0.5, 0.5, 0.5) - hitPos)) - 0.5;
            avgDist = opSmoothUnion(avgDist, dist, 0.2);
          }
        }

        for (int i=0; i<4; i++) {
          vec3 adjacentBlockPos = blockIdx + hitNorm + cornerDirs[i];
          vec4 adjacentBlockVal = blockValueAtIndex(adjacentBlockPos);
          if (adjacentBlockVal.a > 0.0) {
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
          const worldSize = props.gameState.worldSize
          // .data does not change for a slice, so passing scijs slices as data here won't work
          var blocksReshape = ndarray(props.gameState.blocks.data, [worldSize.x, worldSize.y*worldSize.z, 4])
          var blocksTexture = this.regl.texture(blocksReshape)
          return blocksTexture
        },
        worldSize: (context, props) => {
          const worldSize = props.gameState.worldSize
          return [worldSize.x, worldSize.y, worldSize.z]
        },
        viewportSize: (context) => {
          return ([context.viewportWidth, context.viewportHeight])
        },
        fragCoordOffset: (context, props) => props.fragCoordOffset,
        invProjection: (context, props) => {
          // gl-mat4 wasn't getting an inverse matrix (mb bcz NaN in perspective matrix?)
          return props.gameState.camera.projectionMatrixInverse.elements
        },
        invView: (context, props) => {
          // view matrix is this.camera.matrixWorldInverse
          return props.gameState.camera.matrixWorld.elements
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

    this.stopped = false
    this.renderQueue = []
    var renderLoop = time => {
      if (this.renderQueue.length > 0) {
        var targetID = this.renderQueue.pop()
        if (targetID in this.targets) {
          this.render(targetID)
        }
      }
      // if render and try and copy more than once per frame, won't work
      this.animationFrameRequestID = window.requestAnimationFrame(renderLoop)
    }
    this.animationFrameRequestID = window.requestAnimationFrame(renderLoop)
  }

  // should probably just take a gameState, element in the future
  // camera is THREE.js camera, element is standard DOMelement
  // see render() for what a target is
  addTarget(target) {
    if (!(target.element instanceof HTMLCanvasElement)) {
      throw "Element is not a canvas"
    }
    const targetID = this.idCounter
    this.idCounter +=1
    this.targets[targetID] = target
    this.renderQueue.unshift(targetID)
    return targetID
  }

  removeTarget(targetID) {
    delete this.targets[targetID]
  }

  addEventListener(obj, eventName, func) {
    this.listeners.push([obj, eventName, func])
    obj.addEventListener(eventName, func)
  }

  destroy() {
    window.cancelAnimationFrame(this.animationFrameRequestID)
    this.listeners.map(([obj, eventName, func]) => obj.removeEventListener(eventName, func))
    this.regl.destroy()
    this.canvas.remove()
  }

  hexToRGB(h) {
    return [+("0x"+h[1]+h[2]), +("0x"+h[3]+h[4]), +("0x"+h[5]+h[6])]
  }

  render(targetID) {
    const {gameState, element} = this.targets[targetID]
    const sizeOfTargetCanvas = element.getBoundingClientRect();
    const targetedWidth = sizeOfTargetCanvas.width * this.pixelRatio
    const targetedHeight = sizeOfTargetCanvas.height * this.pixelRatio
    element.width = targetedWidth
    element.height = targetedHeight
    this.canvas.width = targetedWidth
    this.canvas.height = targetedHeight
    this.regl.poll() //update viewport dims to canvas dims

    this.regl.clear({
      color: [0, 0, 0, 0],
      depth: 1
    })
    this.drawCommand({gameState, fragCoordOffset: [0,0]})
    if (this.canvas != element) {
      const targetContext = element.getContext("2d")
      targetContext.drawImage(this.canvas, 0, 0)
    }
  }

}

class VoxelEditor extends React.Component {

  constructor(props) {
    super(props)
    this.canvasRef = React.createRef()
    this.containerRef = React.createRef()

    this.initialize()

    this.state = {atPublishDialog: false}

  }

  initialize() {
    const worldSize = new Vector3(16, 17, 16)
    this.camera = new PerspectiveCamera(95, 1.0, 0.1, 1000)
    this.camera.position.set(0.01 + worldSize.x/2, 10, 0)
    this.camera.lookAt(worldSize.clone().divideScalar(2))

    var blocks = (new WorldGenerator({worldSize})).bottomPlate().blocks

    var savedGameStateJSON = window.localStorage.getItem("savedNewItemEditorState")
    this.gameState = new GameState({blocks, camera:this.camera, json:savedGameStateJSON})
  }

  componentDidMount() {

    this.controls = new FlyControls({gameState: this.gameState, domElement: this.canvasRef.current, isDisallowedBlockPos: vector => vector.y == 0})

    this.resizeCamera()
    this.listeners = []
    this.addEventListener(window, "resize", () => this.resizeCamera())

    // parents can access stats.dom to show
    this.stats = new Stats();
    this.stats.showPanel(0);
    this.containerRef.current.appendChild(this.stats.dom)

    this.voxelRenderer = new VoxelRenderer({canvas: this.canvasRef.current, worldSize: this.gameState.worldSize})
    // this.voxelRenderer = new VoxelRenderer({worldSize, topBorderRadius: 14})
    this.renderTargetID = this.voxelRenderer.addTarget({gameState: this.gameState, element: this.canvasRef.current})
    this.controls.externalTick(1/60)
    this.voxelRenderer.render(this.renderTargetID)

    const saveIntervalInSeconds = 10
    var frameCount = 0
    var tick = timestamp => {
      if (document.hasFocus()) {
        this.stats.begin()
        this.controls.externalTick(1/60)
        this.voxelRenderer.render(this.renderTargetID)
        frameCount % (60 * saveIntervalInSeconds) == 0 && this.saveGameState()
        frameCount += 1
        this.stats.end()
      }
      this.animationFrameRequestID = window.requestAnimationFrame(tick)
    }
    this.animationFrameRequestID = window.requestAnimationFrame(tick)

  }

  addEventListener(obj, eventName, func) {
    this.listeners.push([obj, eventName, func])
    obj.addEventListener(eventName, func)
  }

  saveGameState() {
    var json = this.gameState.toJSON()
    window.localStorage.setItem("savedNewItemEditorState", json)
  }

  resetGameState() {
    // would be better to re-run defaults in constructor
    window.localStorage.setItem("savedNewItemEditorState", null)
    var gen = (new WorldGenerator({blocks: this.gameState.blocks})).clear()
    gen.bottomPlate()
    this.gameState.position.set(0.01 + this.gameState.worldSize.x/2, 10, 0)
    this.gameState.camera.rotation.set(0, 0.1, 0)
    this.camera.lookAt(this.gameState.worldSize.clone().divideScalar(2))
    this.camera.updateWorldMatrix()
    this.saveGameState()
  }

  componentWillUnmount() {
    this.saveGameState()
    window.cancelAnimationFrame(this.animationFrameRequestID)
    this.listeners.map(([obj, eventName, func]) => obj.removeEventListener(eventName, func))
    this.voxelRenderer.destroy()
  }

  resizeCamera() {
    const canvas = this.canvasRef.current
    const { height, width} = canvas.getBoundingClientRect();
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  // removes build plate. must copy because regl can't handle slices.
  getPublishableBlocks() {
    var validSlice = this.gameState.blocks.lo(0, 1, 0, 0).hi(16, 16, 16, 4)
    var publishableBlocks = ndarray(new Uint8Array(16*16*16*4), [16, 16, 16, 4])
    np.assign(publishableBlocks, validSlice)
    return publishableBlocks
  }

  render() {
    var sidebar
    if (this.state.atPublishDialog) {
      var onGoBack = () => {
        this.setState({atPublishDialog: false})
        this.controls.interactionEnabled = true
      }
      sidebar = <PublishItemPanel onGoBack={onGoBack} blocks={this.getPublishableBlocks()}/>
    } else {
      var onContinue = () => {
        this.setState({atPublishDialog: true})
        this.controls.interactionEnabled = false
      }
      sidebar = <GameControlPanel gameState={this.gameState} reset={()=>this.resetGameState()} onContinue={onContinue} />
    }


    return (
      <div style={{width: "100%", height:"100%"}}>
        <div style={{display: "flex", padding: THEME.sizing.scale1400, boxSizing: "border-box", height: "100%", minHeight: "400px"}}>
          <div ref={this.containerRef} style={{flexGrow: "1", boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", overflow: "hidden", position: "relative", zIndex: "1", minWidth: "200px", maxWidth: "780px", maxHeight: "610px"}}>
            <canvas ref={this.canvasRef} style={{height: "100%", width: "100%"}}/>
            <div style={{position: "absolute", right: "10px", top: "10px"}}>
              <ControlsHelpTooltip hideEditControls={this.state.atPublishDialog} />
            </div>
          </div>
          <div style={{}}>
            <div style={{boxSizing: "border-box", boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", padding: THEME.sizing.scale600, marginLeft: THEME.sizing.scale1400, marginBottom: THEME.sizing.scale1400, overflowY: "scroll"}}>
              {sidebar}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

class WorldGenerator {
  constructor({worldSize, blocks}) {
    if (worldSize) {
      const worldShape = [worldSize.x, worldSize.y, worldSize.z, 4]
      const numBlocks = worldShape.reduce((a, b) => a*b, 1)
      this.blocks = ndarray(new Uint8Array(numBlocks), worldShape)
    } else if (blocks) {
      this.blocks = blocks
    } else {
      throw "need worldSize or blocks"
    }
    return this
  }

  bottomPlate(blockID) {
    var bottomSlice = this.blocks.lo(0, 0, 0, 3).hi(this.blocks.shape[0], 1, this.blocks.shape[2], 1)
    var blockID = blockID == undefined ? 1 : blockID
    np.assigns(bottomSlice, blockID)

    return this
  }

  colorStripe() {
    for (var z = 0; z < this.blocks.shape[2]; z++) {
      this.blocks.set(1, 1, z, 3, z)
    }
    return this
  }

  clear() {
    np.assigns(this.blocks, 0)
    return this
  }

  // puts random color rand size prism on floor flate
  // working with nddaray-ops not easy
  randomRectangularPrism() {
    const worldShape = ndarray(this.blocks.shape.slice(0, 3))

    var widths = ndarray(Array(3))
    var startCornerPos = ndarray(Array(3))

    np.muleq(np.random(widths), worldShape)
    np.divseq(widths, 2)
    np.flooreq(widths)
    np.addseq(widths, 1) //min width of 1

    np.sub(startCornerPos, worldShape, widths)
    np.divseq(startCornerPos, 2)
    np.flooreq(startCornerPos)
    startCornerPos.set(1, 1) //make it rest on the floor plate

    var randomColor = Math.floor(Math.random() * 16) * 1
    var prismSlice = this.blocks.lo(...startCornerPos.data, 3).hi(...widths.data, 1)
    np.assigns(prismSlice, randomColor)

    return this
  }

}

class GameState {

  // modified Island Joy 16: kerrielake
  blockColors = [
    {id:1,name: "white", hex: "#ffffff"},
    {id:2,name: "peach", hex: "#f7b69e"},
    {id:3,name: "clayRed", hex: "#cb4d68"},
    {id:4,name: "crimson", hex: "#c92464"},
    {id:5,name: "orange", hex: "#f99252"},
    {id:6,name: "yellow", hex: "#f7e476"},
    {id:7,name: "livelyGreen", hex: "#a1e55a"},
    {id:8,name: "leafGreen", hex: "#5bb361"},
    {id:9,name: "teal", hex: "#6df7c1"},
    {id:10,name: "waterBlue", hex: "#11adc1"},
    {id:11,name: "coralBlue", hex: "#1e8875"},
    {id:12,name: "royalPurple", hex: "#6a3771"},
    {id:13,name: "deepPurple", hex: "#393457"},
    {id:14,name: "gray", hex: "#606c81"},
    {id:15,name: "brown", hex: "#644536"},
    {id:16,name: "rock", hex: "#9b9c82"},
  ]

  defaultCamera = () => new PerspectiveCamera(95, 1.0, 0.1, 1000)

  constructor(options) {
    if (options.json) {
      options = {...options, ...this.fromJSON(options.json)}
    }

    this.selectedBlockColor = 1
    this.blocks = options.blocks

    this.camera = options.camera || this.defaultCamera()
    if (options.playerState) {
      this.camera.position.copy(options.playerState.position)
      this.camera.rotation.copy(options.playerState.rotation)
    }
    this.position = this.camera.position
    this.blocks = options.blocks
    this.worldSize = new Vector3(...options.blocks.shape.slice(0, 3))
  }

  toJSON() {
    var blocks = {data: this.blocks.data, shape: this.blocks.shape}
    var playerState = {position: this.camera.position, rotation: this.camera.rotation}
    var json = JSON.stringify({blocks, playerState})
    return json
  }

  fromJSON(json) {
    try {
      var jsonObject = JSON.parse(json)
      var blockArray = new Uint8Array(Object.values(jsonObject.blocks.data))
      var blocks = ndarray(blockArray, jsonObject.blocks.shape)
      var playerState = jsonObject.playerState

      var valid // to check validity of saved data
      valid = (new Vector3()).copy(playerState.position)
      valid = (new Vector3()).copy(playerState.rotation)

      return {blocks, playerState}
    } catch(e) {
      console.log(e)
      return {}
    }
  }

  //serializes a slice, used as input to hash.  e.g. lo=[0, 1, 0] hi=[16, 16, 16]
  serializeBlockData(lo, hi) {
    var slice = this.blocks.lo(lo).hi(hi)
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
    within = within && (pos.x < this.worldSize.x) && (pos.x >= 0)
    within = within && (pos.y < this.worldSize.y) && (pos.y >= 0)
    within = within && (pos.z < this.worldSize.z) && (pos.z >= 0)
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

class GameControlPanel extends React.Component {
  constructor(props) {
    super(props)
    this.gameState = props.gameState
    this.state = {
      selectedBlockColor: this.gameState.selectedBlockColor,
      buildPlate: true,
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

  toggleBuildPlate() {
    var newToggleState = !this.state.buildPlate
    var blockId = newToggleState == true ? 1 : 0
    var gen = (new WorldGenerator({blocks: this.gameState.blocks})).bottomPlate(blockId)
    this.setState({buildPlate: newToggleState})
  }

  render() {
    var colorPicker = <div style={{display: "grid", gridTemplateColumns: "repeat(4, min-content)", rowGap: THEME.sizing.scale400, columnGap: THEME.sizing.scale400}}>
      {this.gameState.blockColors.map(color => {
        var isSelected = this.state.selectedBlockColor == color.id
        var border = isSelected ? "2px solid #00C5CD" : "1px solid #000"
        var size = isSelected ? 28 : 30 //not sure why 30px vs 31px results in no visible size change.
        var onClick = e => {
          this.setSelectedBlockColor(color.id)
        }
        var div = <div
          style={{backgroundColor: color.hex, height: `${size}px`, width: `${size}px`, borderRadius: "5px", cursor: "pointer", border}}
          onClick={onClick}
          key={color.hex}
          >
        </div>
        return div
      })}
    </div>

    var onResetConfirm = () => {
      this.props.reset()
      this.setState({buildPlate: true})
    }
    //grid makes text wrap to width of largest div if make gridTemplateColumns min-content
      // <div style={{display: "grid", gridTemplateColumns: "min-content", height: "min-content", width: "300px"}}>
    return (
      <div style={{display: "grid", height: "min-content", width: "250px"}}>
        <LabelMedium>
          Control
        </LabelMedium>
        <Caption1>
          Change the block color you put down
        </Caption1>
        {colorPicker}
        <Caption1>
          Show or hide the build plate. It will not show up in your final item.
        </Caption1>
        <Button size={SIZE.compact} kind={KIND.secondary} onClick={() => this.toggleBuildPlate()}> Toggle build plate </Button>
        <ResetButtonWithConfirm onConfirmed={onResetConfirm}/>
        <Caption1>
          Continue to minting item
        </Caption1>
        <Button size={SIZE.compact} kind={KIND.primary} onClick={this.props.onContinue}>Continue</Button>
      </div>
    )
  }
}

class PublishItemPanel extends React.Component {
  constructor(props) {
    super(props)
    // should take ndarray blockdata as input

    this.voxelRenderer = new VoxelRenderer({pixelRatio:window.devicePixelRatio})

    var savedState
    try {savedState = JSON.parse(window.localStorage.getItem("publishItemPanelState"))}
    catch(e) {console.log(e)}

    this.state = savedState || {
      forSale: false,
      price: "",
      name: "",
      description: "",
    }

  }

  componentWillUnmount() {
    this.voxelRenderer.destroy()
  }

  componentDidUpdate() {
    window.localStorage.setItem("publishItemPanelState", JSON.stringify(this.state))
  }

  onMint() {
    // finished =>
    // clear localstorage
    // reset blocks
  }

  ethStringToWei(amountString) {
    const ETH_DECIMALS = 18
    var tokenMultiplier = BigNumber(10).pow(BigNumber(ETH_DECIMALS))
    var convertedAmount = tokenMultiplier.multipliedBy(BigNumber(amountString))
    return convertedAmount
  }


  render() {
    var caption = (text, errorText, isError) => <>
        <Caption1 color={isError ? ["negative400"] : undefined}>
          {isError ? errorText : text}
        </Caption1>
      </>

    var priceBN = this.ethStringToWei(this.state.price)
    var priceValid = !priceBN.isNaN() && priceBN.gte(0)

    var nameValid = true //this.state.name && (/^[a-zA-Z0-9 ]+$/).test(this.state.name) // still want emoji

    var descriptionValid = true //this.state.name && (/^[a-zA-Z0-9 ]+$/).test(this.state.description)

    var allInputValidated = priceValid && nameValid && descriptionValid
        // <ArrowLeft size={28} />

    var priceArea = <div style={{display: "grid", gridTemplateColumns: "min-content 1fr", whiteSpace: "nowrap", alignItems: "center", columnGap: THEME.sizing.scale600}}>
      <Checkbox checked={this.state.forSale} onChange={e => this.setState({forSale: e.target.checked})} labelPlacement={LABEL_PLACEMENT.right}>
        For sale
      </Checkbox>
      <div style={{visibility: this.state.forSale ? "unset" : "hidden"}}>
        <Input size={SIZE.compact} placeholder={"price"} onChange={e => this.setState({price: e.target.value})} endEnhancer={"ETH"} error={this.state.price && !priceValid} inputMode={"decimal"} />
      </div>

    </div>


    return <>
      <div style={{display: "grid", gridTemplateColumns: "1fr", height: "min-content", width: "250px"}}>
        <LabelMedium>
          Mint
        </LabelMedium>
        {caption("Name of the item (required)", "Name can only have letters and numbers", this.state.name && !nameValid)}
        <Input size={SIZE.compact} placeholder={"Item name"} value={this.state.name} onChange={e => {this.setState({name: e.target.value})}} />
        {caption("Description for the item (required)", "Description can only have letters and numbers", this.state.decription && !descriptionValid)}
        <Input size={SIZE.compact} placeholder={"Item description"} value={this.state.description} onChange={e => {this.setState({description: e.target.value})}} />
        <Caption1>
          Whether to list on the store. You can always change this later.
        </Caption1>
        {priceArea}
        <Caption1>
          See a preview of your item below
        </Caption1>
        <div style={{display: "flex", justifyContent: "center", marginBottom: "1em"}}>
          <ListingCard listingData={{blocks: this.props.blocks, name: this.state.name, price: this.state.price, notForSale: !this.state.forSale, description: this.state.description}} voxelRenderer={this.voxelRenderer} imageSize={220} autoOrbit />
        </div>
        <div style={{display: "grid", gridAutoColumn: "1fr", gridAutoFlow: "column", columnGap: THEME.sizing.scale600}}>
          <Button size={SIZE.compact} kind={KIND.secondary} onClick={this.props.onGoBack}> Go back </Button>
          <Button size={SIZE.compact} kind={KIND.primary} onClick={true} disabled={!allInputValidated}>Mint</Button>
        </div>
      </div>
    </>
  }
}

var MintItemFlow = props => {
  // combine this with other component
    var blockHash = keccakUint8Array(props.blocks.data)
    // sign metadata
    // upload metadata to server, have it verified
    // web3 call contract mint function
}

class ResetButtonWithConfirm extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      awaitingConfirmation: false,
      disabledDuringConfirmation: true,
      timeouts: [],
    }
  }

  render() {
    var setToConsideration = () => {
      var timeout1 = window.setTimeout(() => this.setState({disabledDuringConfirmation: false}), 5000)
      var timeout2 = window.setTimeout(() => this.setState({awaitingConfirmation: false}), 10000)
      this.setState({awaitingConfirmation: true, disabledDuringConfirmation: true, timeouts:[timeout1, timeout2]})
    }

    var notAwaiting = <>
      <Caption1>Reset to a blank slate</Caption1>
      <Button size={SIZE.compact} kind={KIND.secondary} onClick={setToConsideration}>Reset build</Button>
    </>

    var cancelTimeouts = () => this.state.timeouts.map(timeout => window.clearTimeout(timeout))
    var cancel = () => {
      cancelTimeouts()
      this.setState({awaitingConfirmation: false})
    }
    var confirm = () => {
      cancelTimeouts()
      this.props.onConfirmed()
      this.setState({awaitingConfirmation: false})
    }
    var awaiting = <>
      <Caption1>Are you sure?</Caption1>
      <div style={{display: "flex"}}>
        <Button size={SIZE.compact} kind={KIND.secondary} onClick={confirm} disabled={this.state.disabledDuringConfirmation} style={{flexGrow: "1"}}>Confirm</Button>
        <Button size={SIZE.compact} kind={KIND.secondary} onClick={cancel} disabled={this.state.disabledDuringConfirmation} style={{flexGrow: "1", marginLeft: "10px"}}>Cancel</Button>
      </div>
    </>

    return (this.state.awaitingConfirmation ? awaiting : notAwaiting)
  }
}

class ControlsHelpTooltip extends React.Component {
  constructor(props) {
    super(props)
    this.state = {hover: false}
  }

  keyRect(icon, height, isSquare, isBlank) {
    var styles = {height, fontSize: height}
    if (isSquare) {styles.width = height}
    if (!isBlank) {styles = {...styles, border: "1px solid #ccc", boxShadow: "1px 1px 1px #ccc"}}
    return <div style={{display: "flex", padding: "2px", borderRadius: "5px", alignItems: "center", justifyContent: "center",  ...styles, margin: "1px", fontFamily: THEME.typography.LabelSmall.fontFamily}}>
      {icon}
    </div>
  }

  centeredLabel(text) {
    return <div style={{display: "flex", alignItems: "center", justifyContent: "start", whiteSpace: "nowrap", ...THEME.typography.LabelSmall, fontWeight: "300", marginTop: "auto", marginLeft: "10px"}} >
      {text}
    </div>
  }

  render() {
    const keyHeight = "10px"
    var wasd = <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr"}}>
      {this.keyRect(" ", keyHeight, true, true)}
      {this.keyRect("w", keyHeight, true)}
      {this.keyRect(" ", keyHeight, true, true)}
      {this.keyRect("a", keyHeight, true)}
      {this.keyRect("s", keyHeight, true)}
      {this.keyRect("d", keyHeight, true)}
    </div>

    var updownleftright = <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr"}}>
      {this.keyRect(" ", keyHeight, true, true)}
      {this.keyRect(<ArrowUp size={keyHeight}/>, keyHeight, true)}
      {this.keyRect(" ", keyHeight, true, true)}
      {this.keyRect(<ArrowLeft size={keyHeight}/>, keyHeight, true)}
      {this.keyRect(<ArrowDown size={keyHeight}/>, keyHeight, true)}
      {this.keyRect(<ArrowRight size={keyHeight}/>, keyHeight, true)}
    </div>

    var shifte = this.keyRect("shift", keyHeight)
    var space = this.keyRect("space", keyHeight)
    var rightClick = this.keyRect(<div style={{display: "flex", alignItems: "center"}}><MdMouse size={keyHeight}/> right</div>, keyHeight )
    var leftClick = this.keyRect(<div style={{display: "flex", alignItems: "center"}}><MdMouse size={keyHeight}/> left</div>, keyHeight )
    var mouseMove = this.keyRect(<div style={{display: "flex", alignItems: "center"}}><ArrowLeft size={keyHeight}/><MdMouse size={keyHeight}/><ArrowRight size={keyHeight}/></div>, keyHeight )
    var e = this.keyRect("e", keyHeight )
    var esc = this.keyRect("esc", keyHeight )
    var breakerLine = <div style={{height:"1px", backgroundColor: "#ccc"}}></div>

    const showEdit = !this.props.hideEditControls
    var tooltipBox = (
      <div style={{display: "grid", gridTemplateColumns: "min-content min-content", rowGap: "10px", borderRadius: "8px", position: "absolute", right: "0", marginTop: "10px", boxShadow:"0px 0px 2px #ccc", padding: THEME.sizing.scale400, backgroundColor: "white", color: THEME.colors.colorSecondary}}>
          {leftClick} {this.centeredLabel("to gain focus")}
          {esc} {this.centeredLabel("lose focus")}
          {e} {this.centeredLabel("toggle focus")}
          {breakerLine} {breakerLine}
          {wasd} {this.centeredLabel("move")}
          {shifte} {this.centeredLabel("go down")}
          {space} {this.centeredLabel("go up")}
          {mouseMove} {this.centeredLabel("look")}
          {showEdit && <>{rightClick} {this.centeredLabel("add block")}</>}
          {showEdit && <>{leftClick} {this.centeredLabel("remove block")}</>}
          {showEdit && <>{updownleftright} {this.centeredLabel("select block type")}</>}
      </div>
    )

    return (
      <div style={{position: "relative", display:"inline-block"}}>
        <IoMdHelp
          onMouseOver={() => this.setState({hover: true})}
          onMouseLeave={() => this.setState({hover: false})}
          size={"25px"}
          color={THEME.colors.colorSecondary}
          style={{padding: "4px", borderRadius: "100%", boxShadow: "0px 0px 3px #ccc", backgroundColor: "white"}}/>
        {this.state.hover && tooltipBox}
      </div>
    )
  }

}


class FlyControls {

  constructor(options) {
    this.gameState = options.gameState
    this.domElement = options.domElement
    this.interactionEnabled = !options.interactionDisabled
    this.isDisallowedBlockPos = options.isDisallowedBlockPos || (() => false)

    this.listeners = []
    this.addEventListener(window, "keydown", e => {
      this.capturingMouseMovement && e.preventDefault()
      this.capturingMouseMovement && this.updateKeystates(e.key, true)
      e.key == "e" && this.toggleMouseCapture()
    })
    this.addEventListener(window, "keyup", e => {
      this.capturingMouseMovement && this.updateKeystates(e.key, false)
    })
    this.addEventListener(this.domElement, "mousedown", e => {
      if (e.which == 1) { // left click
        if (!this.capturingMouseMovement) {
          this.domElement.requestPointerLock()
        } else {
          this.clickBuffer.click += 1
        }
      } else if (e.which == 3 && this.capturingMouseMovement) {
          this.clickBuffer.rightClick += 1
      }
    })
    this.addEventListener(this.domElement, "contextmenu", e => {
      this.capturingMouseMovement && e.preventDefault()
    })
    this.addEventListener(document, 'pointerlockchange', () => {
      if (!(document.pointerLockElement == this.domElement)) {
        this.capturingMouseMovement = false
        this.keyState = {} // prevent sticky keys
      } else {
        this.capturingMouseMovement = true
      }
    });
    this.addEventListener(this.domElement,"mouseup", e => {
    })
    this.addEventListener(this.domElement, "mousemove", e => this.capturingMouseMovement && this.updateMouseBuffer(e.movementX, e.movementY))

    this.keyState = {}
    this.mouseMoveBuffer = {x: 0, y: 0}
    this.clickBuffer = {click: 0, rightClick: 0}
    this.captureMouseMovement = false

    // Configuration
    this.toggleMouseCaptureKey = "e"
    this.maxVelocity = 0.2 // in units/seconds
    this.timeToReachMaxSpeed = 0.6 // in seconds
    this.timeToReachZeroSpeed = 0.2 // in seconds
    this.velocity = new Vector3(0, 0, 0)
    this.rotationSensitivty = 0.005 // in radians per (pixel of mouse movement)

    // Special callback used for e.g. removing block selection
    this.onNextTick = null

  }

  addEventListener(obj, eventName, func) {
    this.listeners.push([obj, eventName, func])
    obj.addEventListener(eventName, func)
  }

  destroy() {
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
    var absVec = new Vector3(Math.abs(vector3.x), Math.abs(vector3.y), Math.abs(vector3.z))
    return absVec
  }

  blockNormalAtLocation(blockIdx, location) {
    var normal = new Vector3(0, 0, 0)
    var dist = blockIdx.clone().addScalar(0.5).sub(location) // vector from location to block Center
    var maxDim = this.argmax(this.abs(dist))
    normal.setComponent(maxDim, -Math.sign(dist.getComponent(maxDim)))
    return [normal, maxDim]
  }

  playerBox(location) {
    var playerBox = new Box3(new Vector3(location.x - 0.3, location.y - 1.3, location.z - 0.3), new Vector3(location.x +0.3, location.y + 0.3, location.z + 0.3))
    return playerBox
  }

  playerCollidesWithCube(potentialCubeIdx, location) {
    var playerBox = this.playerBox(location)
    var blockBox = new Box3(potentialCubeIdx.clone(), potentialCubeIdx.clone().addScalar(1))
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

    var forceDir = new Vector3(0, 0, 0);

    for (var i=0; i < xLocations.length; i++) {
      for (var j=0; j < yLocations.length; j++) {
        for (var k=0; k < zLocations.length; k++) {

          var possibleBlock = new Vector3(xLocations[i], yLocations[j], zLocations[k])
          var isWithinBounds = possibleBlock.clone().clamp(new Vector3(0,0,0), (new Vector3(...this.gameState.blocks.shape)).subScalar(1)).equals(possibleBlock)
          if (isWithinBounds) {
            // var isBlock = this.blocks.get(xLocations[i], yLocations[j], zLocations[k], 3) != 0
            var isBlock = this.gameState.blockExists(possibleBlock)
            if (isBlock) {
              var blockBox = new Box3(possibleBlock.clone(), possibleBlock.clone().addScalar(1))
              var isCollision = playerBox.intersectsBox(blockBox)
              if (isCollision) {
                var bodyRef
                if (j == 0) {
                  bodyRef = (new Vector3(0, -1, 0)).add(newLocation) // reference from bottom block of body
                } else if (j == 1) {
                  bodyRef = (new Vector3(0, -0.5, 0)).add(newLocation) // reference from middle of body
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

  interactionTick(cameraDirection) {
    var raymarchResult = this.gameState.raymarchToBlock(this.gameState.position, cameraDirection, 5)
    if (raymarchResult) {
      var [blockPos, hitPos] = raymarchResult
      this.gameState.toggleBlockOutline(blockPos, true)
      this.onNextTick = () => this.gameState.toggleBlockOutline(blockPos, false)
    }

    if (this.clickBuffer.rightClick > 0) {
      if (raymarchResult) {
        var [blockPos, hitPos] = raymarchResult
        var [normal, dim] = this.blockNormalAtLocation(blockPos, hitPos)
        var newBlockPos = normal.add(blockPos)
        for (var i = 0; i< this.clickBuffer.rightClick; i++) {
          if (!this.playerCollidesWithCube(newBlockPos, this.gameState.position)) {
            if (!this.isDisallowedBlockPos(newBlockPos)) {
              if (this.gameState.withinWorldBounds(newBlockPos)) {
                this.gameState.addBlock(newBlockPos, this.gameState.selectedBlockColor)
              }
            }
          }
        }
      }
    } else if (this.clickBuffer.click > 0) {
      for (var i = 0; i< this.clickBuffer.click; i++) {
        var raymarchResult = this.gameState.raymarchToBlock(this.gameState.position, cameraDirection, 5)
        if (raymarchResult) {
          var [blockPos, hitPos] = raymarchResult
          if (!this.isDisallowedBlockPos(blockPos)) {
            this.gameState.removeBlock(blockPos)
          }
        }
      }
    }
  }

  moveLookTick(cameraDirection, timeDelta) {
    var forceVector = new Vector3(0, 0, 0)

    if ("w" in this.keyState) {
      forceVector.add(cameraDirection)
    } if ("s" in this.keyState) {
      forceVector.add(cameraDirection.clone().negate())
    } if ("a" in this.keyState) {
      forceVector.add((new Vector3(0, 1, 0)).cross(cameraDirection))
    } if ("d" in this.keyState) {
      forceVector.add((new Vector3(0, 1, 0)).cross(cameraDirection).negate())
    } if (" " in this.keyState) {
      forceVector.add(new Vector3(0, 1, 0))
    } if ("shift" in this.keyState) {
      forceVector.add(new Vector3(0, -1, 0))
    }

    const acceleration = this.maxVelocity * (timeDelta/this.timeToReachMaxSpeed)
    const deceleration = this.maxVelocity * (timeDelta/this.timeToReachZeroSpeed)
    forceVector.multiplyScalar(acceleration)
    // don't apply decel force that will flip velocity sign
    var decelerationForce = this.velocity.clone().normalize().negate().multiplyScalar(Math.min(deceleration, this.velocity.length()))

    // Have constant deceleration force when no input.
    var haveMoveInput = !forceVector.equals(new Vector3(0, 0, 0))
    if (haveMoveInput) {
      forceVector.sub(decelerationForce)
    }
    forceVector.add(decelerationForce)


    var candidateVelocity = this.velocity.clone().add(forceVector)
    candidateVelocity.clampLength(0, this.maxVelocity) // convenient
    var candidatePosition = this.gameState.position.clone().add(candidateVelocity)

    this.checkCollisionUpdateVel(candidatePosition, candidateVelocity)
    this.velocity = candidateVelocity
    var newPosition = this.gameState.position.clone().add(candidateVelocity)
    this.gameState.position.set(newPosition.x, newPosition.y, newPosition.z)

    // Camera rotation
    // Can move head more than 90 deg if move camera quickly
    var cameraCrossVec = (new Vector3(0, 1, 0)).cross(cameraDirection).normalize()
    var angleToStraightUpDown = cameraDirection.angleTo(new Vector3(0, 1, 0)) // straight up and down
    const minAngle = 0.2
    var tiltDir = Math.sign(this.mouseMoveBuffer.y)
    if ((angleToStraightUpDown < minAngle && tiltDir == 1) || (angleToStraightUpDown > (Math.PI - minAngle) && tiltDir == -1) || (angleToStraightUpDown > minAngle && angleToStraightUpDown < (Math.PI - minAngle))) {
      this.gameState.camera.rotateOnWorldAxis(cameraCrossVec, this.rotationSensitivty * this.mouseMoveBuffer.y)
    }
    this.gameState.camera.rotateOnWorldAxis(new Vector3(0, 1, 0), -this.rotationSensitivty * this.mouseMoveBuffer.x)


  }

  externalTick(timeDelta) {
    this.onNextTick && this.onNextTick()
    this.onNextTick = null

    var cameraDirection = new Vector3()
    this.gameState.camera.getWorldDirection(cameraDirection)

    // moving, looking, colliding
    this.moveLookTick(cameraDirection, timeDelta)
    this.mouseMoveBuffer = {x: 0, y: 0}

    // adding blocks, removing blocks, block highlight
    if (!this.interactionEnabled) {
      this.clickBuffer = {rightClick: 0, click: 0} //still run tick so we can get block outlines so people can count blocks
    }
    this.interactionTick(cameraDirection)
    this.clickBuffer = {rightClick: 0, click: 0}
  }
}

class AutomaticOrbiter {
  constructor(camera, options) {
    this.camera = camera

    this.period = options.period
    this.height = options.height
    this.radius = options.radius
    this.lookAtPos = options.lookAtPos
    this.center = options.center
  }

  setRotationToTime(time) {
    var rotationTime = 2 * (Math.PI/this.period) * time
    var newPos = (new Vector3(Math.cos(rotationTime)*this.radius, this.height, Math.sin(rotationTime)*this.radius)).add(this.center)
    this.camera.position.set(newPos.x, newPos.y, newPos.z)
    this.camera.lookAt(this.lookAtPos)
    this.camera.updateWorldMatrix()
  }
}

// note: web3 sha3 is actually keccak256. sha-3 standard is different from keccak256
function keccakUint8Array(array) {
  const hash = new Keccak(256)
  hash.update(Buffer.from(array))
  hashHex = "0x" + hash.digest("hex")
  return hashHex
}

// Code that runs in module

const datastore = new Datastore()
const THEME = LightTheme
const engine = new Styletron();

ReactDOM.render((
	<StyletronProvider value={engine}>
		<BaseProvider theme={THEME}>
			<App/>
		</BaseProvider>
	</StyletronProvider>
), document.getElementById('root'));
