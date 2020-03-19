// require('babel-polyfill')
var React = require("react")
var ReactDOM = require("react-dom")
import { Router, Link as RouterLink, navigate } from "@reach/router"

import Voxels from "./voxels.jsx"

const CopyToClipboard = require('clipboard-copy')
import {Client as Styletron} from 'styletron-engine-atomic';
import {Provider as StyletronProvider} from 'styletron-react';
import {useStyletron} from 'baseui';
import {LightTheme, BaseProvider, styled} from 'baseui';
import { StyledLink } from "baseui/link";
import { Button, KIND, SIZE } from "baseui/button";
import { Input } from "baseui/input"
import { Search } from "baseui/icon";

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
import {FlexGrid, FlexGridItem} from 'baseui/flex-grid';
import {Grid, Cell} from 'baseui/layout-grid'; //NOT meant for items -- meant for site layout
import {
  Card,
  StyledBody,
  StyledAction
} from "baseui/card";

import Sentencer from "sentencer"
import UsernameGenerator from "username-generator"
import { decode } from "blurhash"
import Faker from "faker"
import RandomGen from "random-seed"

class Datastore {

  listingCache = {}
  userCache = {}
  imageCache = {}


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

  getListingDataById(id) {
    if (id in this.listingCache) {
      return this.listingCache[id]
    }

    const price = Math.round(Math.random()*100)/100
    var name = Sentencer.make("{{ adjective }} {{ noun }}")
    name = name[0].toUpperCase() + name.slice(1, name.length)
    const ownerId = id

    const data = {price, name, ownerId}
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
  }

  render() {
    return (
      <div style={{display: "flex", flexDirection: "column", height: "100%"}}>
        <div>
          <Header/>
        </div>
        <div style={{flex: "auto", position: "relative"}}>
          <div style={{position: "absolute", top: "0", left: "0", bottom: "0", right: "0"}}>
            <div style={{width: "100%", height: "100%"}}>
              <Router>
                <LandingPage path="/"/>
                <Listings path="/home"/>
                <Listing path="/item/:id"/>
                <Voxels path="/newItem"/>
              </Router>
            </div>
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
  }

  render() {
    var cards = [...Array(100).keys()].map(idx => {
      return (
        <div style={{marginRight: this.sideMargins, marginBottom: this.topBottomMargins}} key={idx} >
          <ListingCard id={idx} />
        </div>
      )
    })

    var hiddenSpacers = [...Array(10).keys()].map(idx => {
      return (
        <div style={{marginRight: this.sideMargins, maxHeight:"0", visibility: "hidden", overflow: "hidden"}} key={idx+"sp"} >
          <ListingCard id={idx}/>
        </div>
      )
    })

    return (
      <div style={{display: "flex", justifyContent: "center", alignItems: "start", flexWrap: "wrap", marginLeft: this.sideMargins, marginTop: this.topBottomMargins,}}>
        {cards}
        {hiddenSpacers}
      </div>
    )


  }
}

class ListingCard extends React.Component {

  imageSize = 200

  constructor(props) {
    super(props)
    this.state = {
      canvasRef: React.createRef()
    }
  }

  componentDidMount() {
    const pixels = datastore.generateRandomBlurredImageData(this.props.id, this.imageSize, this.imageSize)
    const canvas = this.state.canvasRef.current
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas.getBoundingClientRect()
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }

  render() {
    var onClick = e => {e.preventDefault(); navigate(`item/${this.props.id}`)}
    const { price, name } = datastore.getListingDataById(this.props.id)

    return (
      <div onClick={onClick} style={{boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", overflow: "hidden", cursor: "pointer"}}>
        <div style={{height: this.imageSize+"px", width: this.imageSize+"px", backgroundColor: "#ccc", position: "relative"}}>
          <div style={{position: "absolute", right: "10px", top: "10px"}}>
            <UserAvatar id={this.props.id} size={35} />
          </div>
          <canvas ref={this.state.canvasRef} width={this.imageSize} height={this.imageSize}></canvas>
        </div>
        <div style={{display: "flex", flexDirection: "column", justifyContent: "center", padding: "10px", width: this.imageSize+"px", boxSizing: "border-box"}}>
          <LabelLarge style={{textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden"}}>
            {name}
          </LabelLarge>
          <LabelSmall style={{margin: 0, textAlign: "right", marginTop: "5px"}} color={["contentSecondary"]}>
            {price + " ETH"}
          </LabelSmall>
        </div>
      </div>
    )
  }
}

class UserAvatar extends React.Component {
  constructor(props) {
    super(props)
  }

  render() {
    var onClick = (e => {
      e.stopPropagation(); navigate(`/user/${this.props.id}`)
    })

    const { avatarURL } = datastore.getUserDataById(this.props.id)

    return (
      <div onClick={onClick} style={{height: this.props.size+"px", width: this.props.size+"px", borderRadius: this.props.size/2.0+"px", backgroundColor: "#eee", cursor: "pointer", overflow: "hidden"}}>
        <img src={avatarURL} style={{height: "100%", width: "100%"}}></img>
      </div>
    )
  }
}

class Listing extends React.Component {

  viewAreaSize = 500
  blockMargins = 40

  constructor(props) {
    super(props)
  }

  render() {
    const { price, name, ownerId } = datastore.getListingDataById(this.props.id)
    const owner = datastore.getUserDataById(ownerId)

    return (
        <div style={{display: "flex", justifyContent: "center", alignItems: "center", padding: "20px"}}>
          <div style={{display: "flex", flexWrap: "wrap"}}>
            <div style={{width: this.viewAreaSize+"px", height: this.viewAreaSize+"px", boxShadow: "0px 1px 2px #ccc", borderRadius: "20px", overflow: "hidden", backgroundColor: "#ccc", margin: this.blockMargins+"px"}}>
            </div>
            <div style={{width: this.viewAreaSize+"px", maxWidth: this.viewAreaSize + "px", display: "flex", flexDirection: "column", margin: this.blockMargins+"px"}}>
              <DisplaySmall color={["colorSecondary"]}>
                {name}
              </DisplaySmall>
              <div style={{display: "flex", marginTop: "10px", alignItems: "center", paddingLeft: "2px"}}>
                <LabelLarge color={["colorSecondary"]}>
                  {"Owned by"}
                </LabelLarge>
                <div style={{paddingRight: "10px", paddingLeft: "10px"}}>
                  <UserAvatar size={35} id={ownerId}/>
                </div>
                <LabelLarge color={["colorSecondary"]}>
                  {owner.name}
                </LabelLarge>
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

    return (
      <HeaderNavigation>
        <StyledNavigationList $align={ALIGN.left}>
          <StyledNavigationItem>
            <DisplayMedium onClick={() => navigate("/")}
              style={{userSelect: "none", cursor: "pointer", paddingLeft: "0"}}>
              Polytope
            </DisplayMedium>
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
            <Button onClick={() => navigate("home")} kind={KIND.minimal} size={SIZE.default}>
              Home
            </Button>
          </StyledNavigationItem>
          <StyledNavigationItem style={{paddingLeft: "0"}}>
            <Button onClick={() => navigate("newItem")} kind={KIND.minimal} size={SIZE.default}>
              Create Item
            </Button>
          </StyledNavigationItem>
        </StyledNavigationList>
        <StyledNavigationList $align={ALIGN.right} style={{marginRight: "20px"}}>
          <StyledNavigationItem>
            <Button>Sign In</Button>
          </StyledNavigationItem>
        </StyledNavigationList>
      </HeaderNavigation>
    )
  }
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
