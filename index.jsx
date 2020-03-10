// require('babel-polyfill')
var React = require("react")
var ReactDOM = require("react-dom")
import { Router, Link as RouterLink, navigate } from "@reach/router"

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
import { decode } from "blurhash"


class App extends React.Component {

  constructor(props) {
    super(props)
  }

  render() {
    return (
      <div style={{paddingLeft: "5px", paddingRight: "5px", display: "flex", flexDirection: "column", height: "100%"}}>
        <div>
          <Header/>
        </div>
        <div style={{flex: "auto", position: "relative"}}>
          <div style={{position: "absolute", top: "0", left: "0", bottom: "0", right: "0"}}>
            <Router>
              <LandingPage path="/"/>
              <Listings path="/home"/>
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
  }

  render() {
    var cards = [...Array(10).keys()].map(item => {

      var price = Math.round(Math.random()*100)/100
      var label = Sentencer.make("{{ adjective }} {{ noun }}")
      label = label[0].toUpperCase() + label.slice(1, label.length)

      return (
        <div style={{marginRight: this.sideMargins, marginBottom: this.topBottomMargins}} key={item} >
          <ListingCard {...{price, label}} />
        </div>
      )
    })

    var hiddenSpacers = [...Array(10).keys()].map(item => {
      return (
        <div style={{marginRight: this.sideMargins, maxHeight:"0", visibility: "hidden", overflow: "hidden"}} key={item+"sp"} >
          <ListingCard/>
        </div>
      )
    })

    return (
      <div style={{height: "100%", overflow: "auto"}}>
        <div style={{display: "flex", justifyContent: "center", alignItems: "start", flexWrap: "wrap", marginLeft: this.sideMargins, marginTop: this.topBottomMargins,}}>
          {cards}
          {hiddenSpacers}
        </div>
      </div>
    )


  }
}

class ListingCard extends React.Component {

  imageSize = 200
  ownerIconSize = 35

  constructor(props) {
    super(props)
    this.state = {
      canvasRef: React.createRef()
    }
  }

  componentDidMount() {
    var res = 4
    var blurhashEncoding = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~"
    var randomBlurhash = [...Array(6+(res*res-1)*2).keys()].map(i => Math.floor(blurhashEncoding.length * Math.random())).map(i => blurhashEncoding[i])
    randomBlurhash[0] = blurhashEncoding[(res-1) + (res-1)*9]
    randomBlurhash = randomBlurhash.join("")

    const pixels = decode(randomBlurhash, this.imageSize, this.imageSize);
    const canvas = this.state.canvasRef.current
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas.getBoundingClientRect()
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }

  render() {

    return (
      <div style={{boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", overflow: "hidden", cursor: "pointer"}}>
        <div style={{height: this.imageSize+"px", width: this.imageSize+"px", backgroundColor: "#ccc", position: "relative"}}>
          <div style={{height: this.ownerIconSize+"px", width: this.ownerIconSize+"px", borderRadius: this.ownerIconSize/2.0+"px", backgroundColor: "#eee", position: "absolute", right: "10px", top: "10px"}}>
          </div>
          <canvas ref={this.state.canvasRef} width={this.imageSize} height={this.imageSize}></canvas>
        </div>
        <div style={{display: "flex", flexDirection: "column", justifyContent: "center", padding: "10px", width: this.imageSize+"px", boxSizing: "border-box"}}>
          <LabelLarge style={{textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden"}}>
            {this.props.label}
          </LabelLarge>
          <LabelSmall style={{margin: 0, textAlign: "right", marginTop: "5px"}} color={["contentSecondary"]}>
            {this.props.price + " ETH"}
          </LabelSmall>
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
            <RouterLink to="home">
              <Button kind={KIND.minimal} size={SIZE.default}>
                Home
              </Button>
            </RouterLink>
          </StyledNavigationItem>
          <StyledNavigationItem style={{paddingLeft: "0"}}>
            <RouterLink to="newItem">
              <Button kind={KIND.minimal} size={SIZE.default}>
                Create Item
              </Button>
            </RouterLink>
          </StyledNavigationItem>
        </StyledNavigationList>
        <StyledNavigationList $align={ALIGN.right}>
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
ReactDOM.render((
	<StyletronProvider value={engine}>
		<BaseProvider theme={THEME}>
			<App/>
		</BaseProvider>
	</StyletronProvider>
), document.getElementById('root'));
