// React / babel stuff
var React = require("react")
var ReactDOM = require("react-dom")
import { Router, Link as RawRouterLink, navigate, Redirect, useLocation} from "@reach/router"
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
import {Vector3, PerspectiveCamera, Box3, Quaternion} from 'three';
import Regl from "regl"
import ndarray from "ndarray"
import mat4 from "gl-mat4"
import np from "ndarray-ops"
import VoxExporter from "./VoxExporter.js"
import voxImport from "parse-magica-voxel"

// Baseweb UI stuff
const CopyToClipboard = require('clipboard-copy')
import {Provider as StyletronProvider} from 'styletron-react';
import {Client as Styletron} from 'styletron-engine-atomic';
import {useStyletron} from 'baseui';
import {LightTheme, BaseProvider, styled} from 'baseui';
import { StyledLink } from "baseui/link";
import { ListItem } from "baseui/list";
import { Button, KIND, SIZE, SHAPE } from "baseui/button";
import { Input as InputBroken } from "baseui/input"
import { Search } from "baseui/icon";
import { Select } from "baseui/select";
import { Notification, KIND as NotificationKind} from "baseui/notification";
import { toaster, ToasterContainer } from "baseui/toast";
import { Checkbox, LABEL_PLACEMENT } from "baseui/checkbox";
import { StatefulTooltip, PLACEMENT } from "baseui/tooltip";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronRight, Check } from "baseui/icon"
import { MdMouse } from "react-icons/md"
import {IoMdHelpCircleOutline, IoMdHelp, IoMdInformationCircleOutline} from "react-icons/io"
import {AiOutlineDownload} from "react-icons/ai"
import { Navigation } from "baseui/side-navigation";
import { Spinner } from "baseui/spinner";
import { Modal, ModalBody } from "baseui/modal";

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
import randy from "randy"
import UsernameGenerator from "username-generator"
import { decode } from "blurhash"
import RandomGen from "random-seed"

// Endpoints
var APIEndpoint = "https://app.polytope.space"
const tokenContractABI = require("./tokenABI.json")
const marketContractABI = require("./marketABI.json")
var tokenContractAddress = "0xe8AA46D8d5565CB7F2F3D9686B0c77f3a6813504"
var marketContractAddress = "0x301D5e7C1c5e97C2ac81ce979c6c6a9EC87217c8"
const InfuraEndpoint = "wss://mainnet.infura.io/ws/v3/caf71132422240a38d0e98e364dc8779"
var globalDebug = false
if (process.env.NODE_ENV == "development") {
  // APIEndpoint = "http://localhost:5000"
  // APIEndpoint = "http://192.168.10.108:5000"
  // tokenContractAddress = "0xcEEF34aa024F024a872b4bA7216e9741Ac011efe"
  // marketContractAddress = "0xFFA62F9f2Bf85F3fF746194C163d681f4ce686B4"
  globalDebug = true
}
const mintFee = 5000000000000000

class APIFetcher {

  apparatusGenerator = new ApparatusGenerator()

  hashCode(str) {
    return Array.from(String(str))
      .reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0)
  }

  generateUsername({id}) {
    var randySeed = {
      idx: 0,
      seed: [...Array(32).keys()].map(idx => id.slice(2, id.length).charCodeAt(idx))
    }
    randy.setState(randySeed)
    var randomGen = RandomGen.create(this.hashCode(id))

    var processIt = str => {
      str = Sentencer.make(str)
      if (str && randomGen.random() < 0.3) {
        str = str[0].toUpperCase() + str.slice(1, str.length)
      }
      return str
    }

    var parts = []
    parts.push(`${randomGen.random() < 0.3 ? "{{adjective}}" : ""}`)
    parts.push(`{{noun}}`)
    parts.push(`${randomGen.random() < 0.5 ? ".{{noun}}" : ""}`)
    parts.push(`${randomGen.random() < 0.4 ? (randomGen.random()*100).toFixed(0) : ""}`)

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

  generateItemData({id}) {
    var seed = this.hashCode(id)
    var randomGen = RandomGen.create(seed)

    const price = Math.round(randomGen.random()*100)/100
    var name = Sentencer.make("{{ adjective }} {{ noun }}")
    name = name[0].toUpperCase() + name.slice(1, name.length)
    const ownerId = Web3Utils.sha3(id.toString()).slice(0, 42)

    const worldSize = new Vector3(16, 17, 16)
    var gen = (new WorldGenerator({worldSize}))//.worldWithPlate()
    var range = [...Array(Math.floor(randomGen.random()*5)+3)]
    range.forEach((val, idx) => gen.randomRectangularPrism({seed:seed+idx}))
    const blocks = gen.blocks

    var description = Sentencer.make([...Array(Math.floor(randomGen.random()*15))].map(i => "{{noun}}").join(" "))

    var authorId = id+10

    const data = {price, name, ownerId, blocks, description, authorId}
    return data
  }

  async getUser({id}) {
    id = id.toLowerCase()
    var call = this.callEndpoint("/getUserData", [id], "POST").then(res => res.json())
    var data = await call
    var name = data && data[id] && data[id].name

    var user = {
      name: name || this.generateUsername({id}),
      avatarURL: undefined,
      avatarFunction: canvas => this.generateApparatus(canvas, id),
    }

    return user
  }

  async getItem({id}) {
    id = id.toLowerCase()

    var call = this.callEndpoint("/getItemData", [id], "POST").then(res => res.json())
    var res = await call
    if (!res[id] || !res[id][0]) {throw "Item data not found on server"}
    var rawData = res[id] // list of matching items

    return rawData
  }

  async setUserData(messageData) {
    const {id, message, signature} = messageData //assertion of sorts
    var res = await this.callEndpoint("/setUserSettings", messageData, "POST") //will error if fails
  }

  async setFeedback(feedbackData) {
    const {id, feedback} = feedbackData
    var res = await this.callEndpoint("/setFeedback", feedbackData, "POST")
  }

  async setItemData(itemData) {
    const {metadata, metadataHash, id} = itemData
    const {name, description, blocks} = metadata
    var res = await this.callEndpoint("/setItemData", itemData, "POST")
  }

  async getItemDetails({id}) {
    var res = await this.callEndpoint("/getItemDetails", {id}, "POST")
  }

  async getPopularItems() {
    var res = await this.callEndpoint("/getPopularItems", {}, "POST").then(res => res.json())
    return res
  }

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
}

class TokenFetcher {

  // get popular goes in Datastore => {ids}, getByOwner => list of {ids} -- don't think there are batch methods
  // so can have master method that takes {id} => item: {blockchain fields, metadatafields} and verification
    // blockchain: date created, ownerId, authorId, metadataHash (to verify against hash of metadata)
    // metadata  : blocks (to verify against tokenId), name, description
    // These have to be "merged" to get a full item
  async getIdsByOwner({id, web3}) {
    var tokenContract = new web3.eth.Contract(tokenContractABI, tokenContractAddress)
    var numTokens = await tokenContract.methods.balanceOf(id).call()
    numTokens = parseInt(numTokens)
    var fetchPromises = [...Array(numTokens).keys()].map(async (idx) => {
      var tokenId = await tokenContract.methods.tokenOfOwnerByIndex(id, idx).call()
      tokenId = Web3Utils.padLeft(Web3Utils.toHex(tokenId), 256/4)
      return tokenId
    })
    var tokenIds = await Promise.all(fetchPromises)
    return tokenIds
  }

  async numTokens({web3}) {
    var tokenContract = new web3.eth.Contract(tokenContractABI, tokenContractAddress)
    var numTokens = await tokenContract.methods.totalSupply().call()
    return parseInt(numTokens)
  }

  async getIdsByIndexes({web3, indexes}) {
    var tokenContract = new web3.eth.Contract(tokenContractABI, tokenContractAddress)
    var fetchPromises = indexes.map(async (idx) => {
      var tokenId = await tokenContract.methods.tokenByIndex(idx).call()
      tokenId = Web3Utils.padLeft(Web3Utils.toHex(tokenId), 256/4)
      return tokenId
    })
    var tokenIds = await Promise.all(fetchPromises)
    return tokenIds
  }

  async addItemAuthorAndDate({token, tokenContract, web3}) {
    // better to batch the getPastEvents (i.e. can pass array to filter.tokenId for batch)
    const zeroAddress = "0x0000000000000000000000000000000000000000"
    var res = await tokenContract.getPastEvents("Transfer", {
      fromBlock: 0,
      filter: {from: zeroAddress, tokenId: token.id}
    })
    var creationEvent = res[0]
    var blockNumber = creationEvent.blockNumber
    var dateCreated = (await web3.eth.getBlock(blockNumber)).timestamp
    var authorId = creationEvent.returnValues.to
    Object.assign(token, {dateCreated, authorId})
  }

  async addItemOwner({token, tokenContract}) {
    var ownerId = await tokenContract.methods.ownerOf(token.id).call()
    Object.assign(token, {ownerId})
  }

  async addItemMetadataHash({token, tokenContract}) {
    var metadataHash = await tokenContract.methods.tokenMetadataHash(token.id).call()
    metadataHash = Web3Utils.padLeft(Web3Utils.toHex(metadataHash), 256/4)
    Object.assign(token, {metadataHash})
  }

  // assumes tokens have at least their id. COULD also assume that all input tokens have same missing fields.
  async finishProcesing({token, web3}) {
    var tokenContract = new web3.eth.Contract(tokenContractABI, tokenContractAddress)

    var promises = []
    if (!("ownerId" in token)) {
      promises.push(this.addItemOwner({token, tokenContract}))
    }
    if (!("authorId" in token && "dateCreated" in token)) {
      promises.push(this.addItemAuthorAndDate({token, tokenContract, web3}))
    }
    if (!("metadataHash" in token)) {
      promises.push(this.addItemMetadataHash({token, tokenContract}))
    }
    await Promise.all(promises)
    return token
  }

  mintToken({tokenId, metadataHash, userAddress, web3, gasPrice}) {
    var tokenContract = new web3.eth.Contract(tokenContractABI, tokenContractAddress)
    var send = tokenContract.methods.mint(userAddress, tokenId, metadataHash).send({
      from: userAddress,
      gas: 250000,
      value: mintFee,
      gasPrice,
    })
    return send
  }

  async getUserAddress({web3}) {
    var accounts = await web3.eth.getAccounts()
    var userAddress = accounts[0] || null
    return userAddress
  }

  async isApprovedForAll({web3, address, userAddress}) {
    var tokenContract = new web3.eth.Contract(tokenContractABI, tokenContractAddress)
    var approved = await tokenContract.methods.isApprovedForAll(userAddress, address).call()
    return approved
  }

  setApprovedForAll({web3, address, userAddress, approved, gasPrice}) {
    var tokenContract = new web3.eth.Contract(tokenContractABI, tokenContractAddress)
    var send = tokenContract.methods.setApprovalForAll(address, approved).send({
      from: userAddress,
      gas: 50000,
      gasPrice,
    })
    return send
  }
}

class MarketFetcher {
  async getMarketInfo({web3, id}) {
    var marketContract = new web3.eth.Contract(marketContractABI, marketContractAddress);
    var isForSale = await marketContract.methods.isListed(id).call()
    var price = null
    if (isForSale) {
      price = await marketContract.methods.listingPrice(id).call()
    }
    return {isForSale, price}
  }

  setMarketInfo({web3, tokenId, userAddress, isForSale, priceBN, gasPrice}) {
    var marketContract = new web3.eth.Contract(marketContractABI, marketContractAddress);
    var send
    if (!isForSale) {
      send = marketContract.methods.delist(tokenId).send({
        from: userAddress,
        gas: 50000,
        gasPrice,
      })
    } else if (isForSale) {
      send = marketContract.methods.list(tokenId, priceBN.toString()).send({
        from: userAddress,
        gas: 100000,
        gasPrice,
      })
    }
    return send
  }

  buyToken({web3, tokenId, priceBN, userAddress, gasPrice}) {
    var marketContract = new web3.eth.Contract(marketContractABI, marketContractAddress);
    var send = marketContract.methods.buyFungible(tokenId).send({
      from: userAddress,
      gas: 400000,
      value: priceBN.toString(),
      gasPrice,
    })
    return send
  }

  async getRecentSales({web3}) {
    // cheap and expensive can be manipulated by buying your own order, only costs 3%
    var marketContract = new web3.eth.Contract(marketContractABI, marketContractAddress);
    var events = await marketContract.getPastEvents("TokenPurchased", {
      fromBlock: 0, // can change this when need pagination
      filter: {} // can filter later
    })
    var sales = {}
    events.forEach(event => {
      var eventValues = event.returnValues
      var id = Web3Utils.padLeft(Web3Utils.toHex(eventValues.tokenId), 256/4)
      var price = BigNumber(eventValues.price)
      sales[id] = {price}
    })
    return Object.entries(sales).map(([id, val]) => ({id, ...val}))
  }

}


class Datastore {

  cache = {
    user: {},
    item: {},
    web3Stuff: {},
  }
  pendingEndpointCalls= {
    user: {},
    item: {},
    web3Stuff: {},
  }

  subscriptionCounter = 0

  nullType = {
    "user": {name: null, avatarURL: null},
    "item": {price: null, name: null, description: null, isForSale: null, authorId: null, ownerId: null},
  }

  apiFetcher = new APIFetcher()
  tokenFetcher = new TokenFetcher()
  marketFetcher = new MarketFetcher()

  constructor() {
    var web3 = {}
    const infuraWeb3 = new Web3Eth(new Web3Eth.providers.WebsocketProvider(InfuraEndpoint))
    web3.eth = infuraWeb3
    this.setWeb3(web3)
  }

  async getData({id, kind, overrideCache}) {
    id = id.toLowerCase()
    var canUseCache = () => (id in this.cache[kind]) && this.cache[kind][id].fetched && !overrideCache

    if (canUseCache()) {
      return this.cache[kind][id].data
    }

    var data
    if (id in this.pendingEndpointCalls[kind] && !overrideCache) {
      data = await this.pendingEndpointCalls[kind][id]
    } else if (kind == "user") {
      var call = this.apiFetcher.getUser({id})
      this.pendingEndpointCalls[kind][id] = call
      data = await call
    } else if (kind == "item") {
      var call = this.getItem({id}).catch(e => {console.log(`Invalid token ${id}, ${e}`); return "INVALID"})
      this.pendingEndpointCalls[kind][id] = call
      data = await call
    } else if (kind == "web3Stuff") {
      if (id == "useraddress") {
        var call = this.getUserAddress()
        this.pendingEndpointCalls[kind][id] = call
        data = await call
      } else if (id == "ismarketapprovedfortoken") {
        const userAddress = await this.getData({kind: "web3Stuff", id: "userAddress"})
        const web3 =  await this.getData({kind: "web3Stuff", id: "web3"})
        var call = this.tokenFetcher.isApprovedForAll({address: marketContractAddress, web3, userAddress})
        this.pendingEndpointCalls[kind][id] = call
        data = await call
      } else if (id == "web3") {
        return null //should be in cache
      } else {throw `web3stuff ${id} not found`}
    } else {throw "kind not found"}
    delete this.pendingEndpointCalls[kind][id]

    if (canUseCache()) {
      // unlikely, but may have entered cache from overrideCache call when we were waiting
      return this.cache[kind][id].data
    } else {
      this.cache[kind][id] = this.cache[kind][id] || {data: null, subscribers: {}}
      this.cache[kind][id].fetched = true
      this.cache[kind][id].data = data
      Object.values(this.cache[kind][id].subscribers).forEach(callback => callback(data))
      return data
    }
  }

  async getSorting({type, id, page, pageSize}) {
    pageSize = pageSize || 50
    page = page || 0
    this.sortingsCache = this.sortingsCache || {byOwner: {}, new: {}, old: {}, random: {}, popular: {}, cheap: {}, expensive: {}}

    if (type == "byOwner") {
      var subCache = this.sortingsCache["byOwner"]
      if (subCache[id] && subCache[id][page]) { return subCache[id][page]}

      var res = await this.tokenFetcher.getIdsByOwner({id, web3: this.cache["web3Stuff"]["web3"].data})
      subCache[id] = subCache[id] || {}
      subCache[id][page] = res
      return res
    } else if (type == "new" || type == "old" || type == "random") {
      var subCache = this.sortingsCache[type]
      if (subCache[page]) {return subCache[page]}

      var numTokens = this.numTokens || await this.tokenFetcher.numTokens({web3: this.cache["web3Stuff"]["web3"].data})
      this.numTokens = numTokens
      var indexes = []

      if (type == "new") {
        for (var i=Math.max(0, numTokens-(page+1)*pageSize); i<numTokens-page*pageSize; i++) {
          indexes.unshift(i)
        }
      } else if (type == "old") {
        for (var i=page*pageSize; i< Math.min(numTokens, (page=1)*pageSize); i++) {
          indexes.push(i)
        }
      } else if (type == "random") {
        var max = Math.min(numTokens, pageSize)
        while (indexes.length < max) {
          var rand = Math.floor(Math.random() * numTokens)
          !indexes.includes(rand) && indexes.push(rand)
        }
      }
      var ids = await this.tokenFetcher.getIdsByIndexes({web3: this.cache["web3Stuff"]["web3"].data, indexes})
      subCache[page] = ids
      return ids
    } else if (type == "popular") {
      if (this.sortingsCache[type][page]) {return this.sortingsCache[type][page]}
      var ids = await this.apiFetcher.getPopularItems()
      this.sortingsCache[type][page] = ids
      return ids
    } else if (type == "cheap" || type == "expensive") {
      if (this.sortingsCache[type][page]) {return this.sortingsCache[type][page]}
      // TODO: paginate this
      var tokensAndSellPrice = await this.marketFetcher.getRecentSales({web3: this.cache["web3Stuff"]["web3"].data})
      if (type == "cheap") {
          tokensAndSellPrice.sort((a, b) => a.price > b.price)
      } else if (type == "expensive") {
          tokensAndSellPrice.sort((a, b) => a.price < b.price)
      }
      var ids = tokensAndSellPrice.map(dict => dict.id)
      this.sortingsCache[type][page] = ids
      return ids
    }
  }

  async getItem({id}) {
    // return (await this.apiFetcher.generateItemData({id})) //for testing
    var web3 = this.cache["web3Stuff"]["web3"].data

    var apiCall = this.apiFetcher.getItem({id}) // gives list of matching items in DB. could key by metadatahash but would increase fetch time
    var tokenCall = this.tokenFetcher.finishProcesing({token: {id}, web3})
    var marketCall = this.marketFetcher.getMarketInfo({id, web3})
    var [apiItems, tokenItem, marketItem] = await Promise.all([apiCall, tokenCall, marketCall])
    var apiItem
    apiItems.forEach(item => {
      var calculatedMetadataHash = keccakUtf8(JSON.stringify(item.metadata, ["name", "description", "blocks"]))
      var validMetadata = calculatedMetadataHash == tokenItem.metadataHash
      var calculatedBlocksHash = keccakUtf8(JSON.stringify(item.metadata.blocks))
      var validBlocks = calculatedBlocksHash == tokenItem.id
      if (validMetadata && validBlocks) {
        apiItem = item
        return
      }
    })
    if (apiItem == undefined) {throw "Server had no items with correct metadata and blocks hash"}

    var {name, description, blocks} = apiItem.metadata
    if (blocks.length != (16*16*16*1)) {throw "blocks metadata invalid"}
    // might want other checks like above, goal is that if data that was hashed is different, what shows up on screen in the game should be different.

    var blockArray = ndarray(new Uint8Array(blocks), [16,16,16,1])

    var item = {
      name,
      description,
      blocks: blockArray,
      ...tokenItem,
      ...marketItem,
    }
    // blockchain: date created, ownerId, authorId, metadataHash (to verify against hash of metadata)
    // metadata  : blocks (to verify against tokenId), name, description

    return item

  }

  // processRawBlocks(blocksObject) {
  //   var rawBlocks = ndarray(new Uint8Array(blocksObject), [16,16,16,1])
  //   var blocks = ndarray(new Uint8Array(16*16*16*4), [16, 16, 16, 4])
  //   var blockIDSlice = blocks.lo(0, 0, 0, 0).hi(16, 16, 16, 1)
  //   np.assign(blockIDSlice, rawBlocks)
  //   return blocks
  // }
  //
  addDataSubscription({id, kind, callback}) {
    id = id.toLowerCase()
    this.subscriptionCounter += 1
    const subscriptionId = this.subscriptionCounter
    this.cache[kind][id] = this.cache[kind][id] || {fetched: false, data: undefined, subscribers: {}}
    this.cache[kind][id].subscribers[subscriptionId] = callback
    return subscriptionId
  }

  removeDataSubscription({id, kind, subscriptionId}) {
    id = id.toLowerCase()
    delete this.cache[kind][id].subscribers[subscriptionId]
  }

  async trySilentRequestInjectedWeb3() {
    if (window.ethereum == undefined) {return}
    var web3 = {}
    web3.eth = new Web3Eth(window.ethereum)
    var accounts = await web3.eth.getAccounts()
    if (accounts && accounts.length > 0) {
      // if not null, probably won't have popup when .signIn()
      var res = await this.requestInjectedWeb3()
      return res
    }
    return false
  }

  async requestInjectedWeb3() {
    if (window.ethereum == undefined) {
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
        return false
      } else {
        await this.setWeb3(web3)
        await this.getData({kind: "web3Stuff", id: "userAddress", overrideCache: true})
        return true
      }
    } catch (error) {
      console.log(error)
      toaster.warning("Web3 permission was not granted.")
      return false
    }
  }

  async setWeb3(web3) {
    this.cache["web3Stuff"]["web3"] = this.cache["web3Stuff"]["web3"] || {data: undefined, subscribers: {}}
    this.cache["web3Stuff"]["web3"].data = web3
    this.cache["web3Stuff"]["web3"].fetched = true
    Object.values(this.cache["web3Stuff"]["web3"].subscribers).forEach(callback => callback())
  }

  hasWeb3() {
    return (this.cache["web3Stuff"]["web3"] && this.cache["web3Stuff"]["web3"].data)
  }

  // PASSTHROUGH these for now.

  async setUserData(messageData) {
    await this.apiFetcher.setUserData(messageData)
  }
  async setFeedback(feedbackData) {
    await this.apiFetcher.setFeedback(feedbackData)
  }
  async setItemData(itemData) {
    await this.apiFetcher.setItemData(itemData)
  }
  async getItemDetails({id}) {
    // have to wait for web3 before can call this
    var call = async () => {
      var token = await this.getData({kind: "item", id})
      var tokenExists = (token && (token != "INVALID"))
      tokenExists && (await this.apiFetcher.getItemDetails({id}))
    }
    if (this.hasWeb3()) {
      call()
    }
    else {
      var subscriptionId = this.addDataSubscription({id: "web3", kind: "web3Stuff", callback: () => {
        call()
        this.removeDataSubscription({id: "web3", kind: "web3Stuff", subscriptionId})
      }})
    }
  }
  async mintToken({tokenId, metadataHash, userAddress}) {
    var web3 = this.cache["web3Stuff"]["web3"].data
    var gasPrice = Math.floor((await web3.eth.getGasPrice())*1.25)
    var send = this.tokenFetcher.mintToken({tokenId, metadataHash, userAddress, web3, gasPrice})
    return {send}
  }
  getUserAddress() {
    return this.tokenFetcher.getUserAddress({web3: this.cache["web3Stuff"]["web3"].data})
  }
  async setMarketInfo({tokenId, userAddress, isForSale, priceBN}) {
    var web3 = this.cache["web3Stuff"]["web3"].data
    var gasPrice = Math.floor((await web3.eth.getGasPrice())*1.25)
    var send = this.marketFetcher.setMarketInfo({tokenId, userAddress, isForSale, priceBN, web3, gasPrice})
    return {send}
  }
  async setMarketApprovedForToken({approved, userAddress}) {
    var web3 = this.cache["web3Stuff"]["web3"].data
    var gasPrice = Math.floor((await web3.eth.getGasPrice())*1.25)
    var send = this.tokenFetcher.setApprovedForAll({approved, address: marketContractAddress, userAddress, web3, gasPrice})
    return {send}
  }
  async buyToken({userAddress, tokenId, priceBN}) {
    var web3 = this.cache["web3Stuff"]["web3"].data
    var gasPrice = Math.floor((await web3.eth.getGasPrice())*1.25)
    var send = this.marketFetcher.buyToken({userAddress, tokenId, priceBN, web3, gasPrice})
    return {send}
  }
}

var setMarketApprovedForTokenFlow = async (approved, setWaiting, setError) => {
  var userAddress = await datastore.getData({id: "userAddress", kind: "web3Stuff"})
  var approvalStatus = await datastore.getData({id: "isMarketApprovedForToken", kind: "web3Stuff"})
  if (approvalStatus == approved) {return}
  var transactionPromise = new Promise(async (resolve, reject) => {
    var transactionSend = (await datastore.setMarketApprovedForToken({approved, userAddress})).send
    setWaiting("Please approve the transaction")
    setError("")
    transactionSend.on("transactionHash", hash => {
      setWaiting(waitingForConfirmationYouCanLeave)
    }).on("receipt", async (receipt) => {
      setWaiting("Refreshing status")
      await datastore.getData({id: "isMarketApprovedForToken", kind: "web3Stuff", overrideCache: true})
      // should also refresh all items, since card listingPrice can change
      setWaiting("")
      resolve()
    }).on("error", (error, receipt) => {
      console.log(error, receipt)
      setWaiting("")
      setError("Error approving market contract")
      resolve()
    })
  })
  await transactionPromise
}

var TextWithHelpTooltip = props => {
  // Uses invisible spacer -- option-space on mac.
  var tooltip = <>
    <StatefulTooltip
      content={() => props.tooltipMessage}
      showArrow
      placement={PLACEMENT.top}>
      <div style={{display: "inline-flex", alignItems: "center"}}>
        {" "}
        <IoMdInformationCircleOutline size={props.size} style={{color: THEME.colors.colorSecondary, marginLeft: "3px"}}/>
      </div>
    </StatefulTooltip>
  </>
  var component = <>
      {props.text}
      {tooltip}

  </>
  return component
}
const waitingForConfirmationYouCanLeave = <>
  <TextWithHelpTooltip
    tooltipMessage={"The blockchain is processing your transaction(s). You can leave the page if necessary."}
    text={"Waiting for confirmation"}/>
</>

var buyItemFlow = async ({setWaiting, setError}, {itemId, priceBN}) => {
  var userAddress = await datastore.getData({id: "userAddress", kind: "web3Stuff"})
  if (!userAddress) {
    var success = await datastore.requestInjectedWeb3()
    if (!success) {
      setError("Web3 is required to trade")
      return
    }
    var userAddress = await datastore.getData({id: "userAddress", kind: "web3Stuff"})
  }

  setWaiting("Please approve the transaction")
  var transactionPromise = new Promise(async (resolve, reject) => {
    var transactionSend = (await datastore.buyToken({tokenId: itemId, userAddress, priceBN})).send
    transactionSend.on("transactionHash", hash => {
      setWaiting(waitingForConfirmationYouCanLeave)
    }).on("receipt", async (receipt) => {
      setWaiting("Refreshing item")
      await datastore.getData({id: itemId, kind: "item", overrideCache: true})
      setWaiting("")
      resolve()
    }).on("error", (error, receipt) => {
      console.log(error, receipt)
      setWaiting("")
      setError("Error buying item")
      resolve()
    })
  })

  await transactionPromise
}

var setMarketInfoFlow = async ({setWaiting, setError}, {isForSale, priceBN, itemId}) => {
  var userAddress = await datastore.getData({id: "userAddress", kind: "web3Stuff"})
  var approvalStatus = await datastore.getData({id: "isMarketApprovedForToken", kind: "web3Stuff"})

  var marketApprovePromise
  if (isForSale && !approvalStatus) {
    marketApprovePromise = setMarketApprovedForTokenFlow(true, () => null, () => null)
    var whyBoth = <>
      <TextWithHelpTooltip
        tooltipMessage={"The first transaction approves the market contract, the second lists the item"}
        text={"Please approve both market transactions"}/>
    </>
    setWaiting(whyBoth)
  } else {
    marketApprovePromise = () => true
    setWaiting("Please approve the market transaction")
  }

  var transactionPromise = new Promise(async (resolve, reject) => {
    var transactionSend = (await datastore.setMarketInfo({tokenId: itemId, userAddress, isForSale, priceBN})).send
    transactionSend.on("transactionHash", hash => {
      setWaiting(waitingForConfirmationYouCanLeave)
    }).on("receipt", async (receipt) => {
      await marketApprovePromise
      setWaiting("Refreshing item")
      await datastore.getData({id: itemId, kind: "item", overrideCache: true})
      setWaiting("")
      resolve()
    }).on("error", (error, receipt) => {
      console.log(error, receipt)
      setWaiting("")
      setError("Error listing on market")
      resolve()
    })
  })

  await transactionPromise
}

var useGetFromDatastore = ({id, kind, dontUse}) => {
  var [response, setResponse] = React.useState()

  var propsGood = id && true

  // update function that doesn't set data if component unmounted
  var isCancelled = false
  var update = () => {
    // if call datastore function that requires web3 and datastore doesn't have it => error
    var web3Good = (kind == "item" || kind == "web3Stuff") ? datastore.hasWeb3() : true
    web3Good && datastore.getData({id, kind}).then(res => {
      !isCancelled && setResponse(res)
    })
  }
  React.useEffect(() => {
    var cancel = () => {isCancelled = true}
    return cancel
  }, [])

  // first update
  React.useEffect(() => {
    if (propsGood && !dontUse) {
      update()
    }
  }, [id, kind, dontUse])

  // update on item changes
  React.useEffect(() => {
    if (propsGood && !dontUse) {
      var subscriptionId = datastore.addDataSubscription({kind, id, callback: () => update()})
      var cancel = () => datastore.removeDataSubscription({kind, id, subscriptionId})
      return cancel
    }
  }, [id, kind, dontUse])

  // update on web3 changes
  React.useEffect(() => {
    if (propsGood && !dontUse) {
      var subscriptionId = datastore.addDataSubscription({kind:"web3Stuff",id:"web3", callback: () => update()})
      var cancel = () => datastore.removeDataSubscription({kind:"web3Stuff",id:"web3", subscriptionId})
      return cancel
    }
  }, [id, kind, dontUse])

  return dontUse ? null : (response != undefined ? response : datastore.nullType[kind])
}


class App extends React.Component {

  constructor(props) {
    super(props)
  }

  componentDidMount() {
    datastore.trySilentRequestInjectedWeb3().then(success => {
      // default is to use infura web3
    })
  }

  render() {

    return (
      <div style={{display: "grid", gridTemplateRows: "auto 1fr", height: "100%", /*minWidth: "800px"*/}}>
        <ToasterContainer autoHideDuration={3000} overrides={{Root: {style: () => ({zIndex: 2})}}}/>
        <div>
          <Header  />
        </div>
        <Router style={{height: "100%"}}>
          <SidebarAndListings path="/home"/>
          <UserProfile path="/user/:id"/>
        </Router>
        <div style={{flex: "auto", position: "relative"}}>
          <div style={{position: "absolute", top: "0", left: "0", bottom: "0", right: "0"}}>
            <Router primary={false}>
              <LandingPage path="/"/>
              <Listing path="/item/:id"/>
              <VoxelEditor path="/newItem"/>
              <WorldMode path="/world"/>
            </Router>
          </div>
        </div>
      </div>
    )
  }
}

var SidebarAndListings = props => {
  var sidebarItems = [
    {title: "Random", sorting: {type: "random"}},
    {title: "Popular", sorting: {type: "popular"}},
    {title: "New", sorting: {type: "new"}},
    {title: "Cheap", sorting: {type: "cheap"}},
    {title: "Old", sorting: {type: "old"}},
    {title: "Expensive", sorting: {type: "expensive"}},
  ]
  var sidebarItems = sidebarItems.map(item => ({...item, itemId: "#"+item.title.toLowerCase()}))
  const sidebarIds = sidebarItems.map(item => item.itemId)

  const [activeSidebarIdx, setActiveSidebarIdx] = React.useState()

  React.useEffect(() => {
    const defaultSidebarId = "#new"
    const newSidebarId = sidebarIds.includes(props.location.hash) ? props.location.hash : defaultSidebarId
    setActiveSidebarIdx(sidebarIds.indexOf(newSidebarId))
  })
  var onChange = ({event, item, value}) => {
    event && event.preventDefault()
    item && navigate(item.itemId)
    value && navigate(value[0].itemId)
  }

  // setting window title
  if (activeSidebarIdx) {document.title = `Polytope | ${sidebarItems[activeSidebarIdx].itemId}`}

  var listings = <>
    <div style={{position: "relative"}}>
      <div style={{position: "absolute", top: "0", left: "0", bottom: "0", right: "0", overflow: "auto"}}>
        <Listings sorting={(activeSidebarIdx != null) && sidebarItems[activeSidebarIdx].sorting} />
      </div>
    </div>
  </>

  var isMobile = useMediaQuery([0, 700])
  var desktopHtml =  <>
    <div style={{display: "grid", gridTemplateColumns: "auto 1fr", height: "100%"}}>
      <div style={{width: "200px", marginLeft: THEME.sizing.scale1400, marginTop: THEME.sizing.scale1400, boxSizing: "border-box"}}>
        <Navigation items={sidebarItems} activeItemId={sidebarIds[activeSidebarIdx]} onChange={onChange}/>
      </div>
      {listings}
    </div>
  </>
  var mobileHtml = <>
    <div style={{display: "grid", gridTemplateRows: "min-content auto", height: "100%"}}>
      <Select options={sidebarItems} labelKey="title" valueKey="title" value={[sidebarItems[activeSidebarIdx]]} onChange={onChange} clearable={false} searchable={false} />
      {listings}
    </div>
  </>

  var html = isMobile ? mobileHtml : desktopHtml

  return html
}

var UserProfile = props => {
  var canvasRef = React.useRef()
  var [name, setName] = React.useState()
  const [email, setEmail] = React.useState("")

  var user = useGetFromDatastore({kind: "user", id: props.id})
  React.useEffect(() => {
    setName(user.name)
  }, [user.name])

  var setProfilePicture = async () => {
    var canvas = canvasRef.current
    var {width, height} = canvas.getBoundingClientRect()
    canvas.width = width * window.devicePixelRatio
    canvas.height = height * window.devicePixelRatio
    user.avatarFunction(canvas)
  }
  React.useEffect(() => {
    user.avatarFunction && setProfilePicture()
  }, [user.avatarFunction])

  // Name with editor button
  var userAddress = useGetFromDatastore({kind: "web3Stuff", id: "useraddress"})
  var editButton
  if (userAddress == props.id) {
    editButton = <>
      <Caption2 onClick={() => setIsEditing(true)}style={{marginLeft: "4px", textDecoration:"underline", lineHeight: "24px", cursor:"pointer"}}>edit</Caption2>
    </>
  }
  var nameDisplay = <>
    <div style={{display: "grid", gridTemplateColumns: "repeat(2, minmax(auto, min-content))", justifyContent: "center", alignItems: "end"}} >
      <HeadingSmall style={{margin: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
        {user.name}
      </HeadingSmall>
      {editButton}
    </div>
  </>

  // Editing Stuff
  const [isEditing, setIsEditing] = React.useState(false)
  const [waiting, setWaiting] = React.useState("")
  const [notification, setNotification] = React.useState("")

  var emailRegex = (/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)
  var emailValid = emailRegex.test(email)
  var allFieldsValid = (email ? emailValid : true) && name

  var web3 = useGetFromDatastore({kind: "web3Stuff", id: "web3"})
  var signAndUpdate = async () => {
    var validUntil = Math.floor(Date.now()/1000) + 120
    var signature
    var message = `I'm updating my preferences on Polytope with the username ${name} and the email ${email}. This request is valid until ${validUntil}`
    try {
      if (!web3) {throw "No web3!"}
      setWaiting("Waiting for signature")
      var signature = await runWithErrMsgAsync(web3.eth.personal.sign(Web3Utils.fromUtf8(message), props.id), "Signature was not given");
      setWaiting("Uploading to server")
      await runWithErrMsgAsync(datastore.setUserData({message, id:props.id, signature}), "Upload to server failed")
      setWaiting("Setting name")
      await runWithErrMsgAsync(datastore.getData({id: props.id, kind: "user", overrideCache: true}), "Error fetching from server")
      setNotification("")
      setIsEditing(false)
    } catch (e) {
      setWaiting("")
      setNotification(e)
    }
  }
  var caption = (text, errorText, isError) => <>
    <Caption1 color={isError ? ["negative400"] : undefined} style={{textAlign: "left"}}>
      {isError ? errorText : text}
    </Caption1>
  </>
  var notificationHtml = <>
   <Notification kind={NotificationKind.warning} overrides={{Body: {style: {width: 'auto'}}}}>
     {() => notification}
   </Notification>
  </>
  var editHtml = <>
    <div>
      {notification && notificationHtml}
      {caption("Edit your username (required)", "Can't be empty", !name)}
      <Input size={SIZE.compact} placeholder={"username"} value={name} onChange={e => setName(e.target.value)} error={!name}/>
      {caption("Edit your email (won't be shown)", "Invalid email", email && !emailValid)}
      <Input size={SIZE.compact} placeholder={"e.g. email@my.com"} value={email} onChange={e => setEmail(e.target.value)} error={email && !emailValid}/>
    </div>
    <div style={{display: "grid", gridTemplateColumns: "auto auto", columnGap: "15px"}}>
      <Button kind={KIND.secondary} size={SIZE.compact} onClick={() => setIsEditing(false)}>Cancel</Button>
      <Button kind={KIND.primary} size={SIZE.compact} onClick={signAndUpdate} disabled={!allFieldsValid}>Submit</Button>
    </div>
  </>
  var waitingHtml = <>
    <div>
      <Spinner />
    </div>
    <LabelSmall>{waiting}</LabelSmall>
  </>
  var nameArea = isEditing ? (waiting ? waitingHtml : editHtml) : nameDisplay

  // Setting market contract approval
  var viewerIsOwner = userAddress == props.id
  var approveDisapproveButton
  var marketContractApprovalArea
  var [marketWaiting, setMarketWaiting] = React.useState("")
  var marketIsApproved = useGetFromDatastore({kind: "web3Stuff", id: "isMarketApprovedForToken"})
  if (viewerIsOwner) {
    var onClick = () => setMarketApprovedForTokenFlow(!marketIsApproved, setMarketWaiting, () => null)
    approveDisapproveButton = <>
      <Caption2 style={{textAlign: "left"}}>
        {marketIsApproved ? "Disable trading items on the market" : "Enable trading items on the market"}
      </Caption2>
      <Button kind={KIND.primary} size={SIZE.compact} onClick={onClick}>
        {marketIsApproved ? "Revoke Market Access" : "Grant Market Access"}
      </Button>
    </>
    var marketWaitingArea = <>
      <div style={{display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0px 0px 3px #ccc", borderRadius: "15px", padding: THEME.sizing.scale600}}>
        <Spinner size={48}/>
        <LabelLarge style={{marginLeft: THEME.sizing.scale600}}>
          {marketWaiting}
        </LabelLarge>
      </div>
    </>
    marketContractApprovalArea = <>
      {marketWaiting ? marketWaitingArea : approveDisapproveButton}
    </>
  }


  // setting window title
  if (name) {document.title = `Polytope | ${name}`}
  const profilePicSize = 200

  return <>
    <div style={{display: "grid", gridTemplateColumns: "auto 1fr", height: "100%"}}>
      <div style={{width: "200px", marginLeft: THEME.sizing.scale1400, marginTop: THEME.sizing.scale1400}}>
        <div style={{display: "grid", gridTemplateColumns: "auto", textAlign:"center", rowGap: "15px"}}>
          <canvas ref={canvasRef} style={{height: profilePicSize+"px", width: profilePicSize+"px", borderRadius: (profilePicSize/2)+"px", boxShadow: "0px 0px 5px #ccc", backgroundColor: "#eee"}}/>
          {nameArea}
          <LabelSmall style={{overflow: "auto"}} color={["contentSecondary"]}>
            {props.id}
          </LabelSmall>
          {marketContractApprovalArea}
        </div>
      </div>
      <div style={{position: "relative"}}>
        <div style={{position: "absolute", top: "0", left: "0", bottom: "0", right: "0", overflow: "auto"}}>
          <Listings sorting={{type: "byOwner", id: props.id}} />
        </div>
      </div>
    </div>
  </>
}

var Listings = props => {
  const cardGap = THEME.sizing.scale1000
  const sidesGap = THEME.sizing.scale1400

  var containerRef = React.createRef()
  var [cardIds, setCardIds] = React.useState([])
  var [voxelRenderer, setVoxelRenderer] = React.useState()

  React.useEffect(() => {
    var renderer = new VoxelRenderer({pixelRatio:window.devicePixelRatio})
    setVoxelRenderer(renderer)
    var cleanup = () => renderer.destroy()
    return cleanup
  }, [])

  var isWaitingWeb3 = !useGetFromDatastore({kind: "web3Stuff", id: "web3"})
  React.useEffect(() => {
    var isCancelled = false
    var updateCardIds = async () => {
      setCardIds(cardIds.map(id => null)) // don't lag but also don't flash
      var ids = await datastore.getSorting(props.sorting)
      !isCancelled && setCardIds(ids)
    }
    !isWaitingWeb3 && props.sorting && updateCardIds()
    return () => {isCancelled = true}
  }, [props.sorting, isWaitingWeb3])


  var cards = cardIds.map((id, idx) => {
    // var itemId = Web3Utils.sha3(idx.toString())
    var card = <ListingCard key={id || idx} id={id} voxelRenderer={voxelRenderer} imageSize={220} />
    return card
  })

  var waitingWeb3Screen = <>
    <div style={{display: "grid", alignItems: "center", justifyItems: "center", with: "100%", height: "100%"}}>
      <div style={{display: "grid", rowGap: THEME.sizing.scale600, justifyItems: "center"}}>
        <Spinner />
        <LabelLarge>Waiting for web3</LabelLarge>
      </div>
    </div>
  </>


  var listingsScreen = <>
    <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, 220px)", justifyContent: "center", rowGap: cardGap, columnGap: cardGap, maxWidth: "1100px", margin: sidesGap}}>
      {cards}
    </div>
  </>

  return <>
    {isWaitingWeb3 ? waitingWeb3Screen : listingsScreen}
  </>
}

var ListingCard = props => {
  const canvasRef = React.useRef()
  const cardRef = React.useRef()
  var item = useGetFromDatastore({id: props.id, kind: "item", dontUse: props.listingData})
  item = props.listingData || item

  React.useEffect(() => {
    if (!props.voxelRenderer) {return}
    if (!item.blocks) {return}
    var blockDisplayListeners = []
    var addEventListener = (obj, eventName, func) => {
      blockDisplayListeners.push([obj, eventName, func])
      obj.addEventListener(eventName, func)
    }
    var renderId
    var animationFrameRequestId
    var gameState

    var setupBlockdisplay = async () => {
      var {blocks} = item
      var blockData = ndarray(new Uint8Array(16*16*16*4), [16, 16, 16, 4])
      var blockIDSlice = blockData.lo(0, 0, 0, 0).hi(16, 16, 16, 1)
      np.assign(blockIDSlice, blocks)

      gameState = new GameState({blocks: blockData})
      const lookAtPos = new Vector3(gameState.worldSize.x/2, 8, gameState.worldSize.y/2)
      var orbiter = new AutomaticOrbiter(gameState.camera, {center: lookAtPos.clone(), height: 13, period: 10, radius: 1.5*gameState.worldSize.x/2, lookAtPos})
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
        addEventListener(cardRef.current, "touchstart", e => enableRotation())
        addEventListener(canvasRef.current, "mouseleave", e => window.cancelAnimationFrame(animationFrameRequestId))
        addEventListener(cardRef.current, "touchend", e => window.cancelAnimationFrame(animationFrameRequestId))
      }
    }
    var cancelBlockDisplay = () => {
      blockDisplayListeners.map(([obj, eventName, func]) => obj.removeEventListener(eventName, func))
      window.cancelAnimationFrame(animationFrameRequestId)
      props.voxelRenderer.removeTarget(renderId)
      gameState.destroy()
    }
    setupBlockdisplay()
    return cancelBlockDisplay
  }, [props.id, props.voxelRenderer, item.blocks])

  const {price, isForSale, name, description, authorId, ownerId} = item

  var cardInterior = <>
    <canvas ref={canvasRef} style={{height: props.imageSize+"px"}} width={props.imageSize} height={props.imageSize}></canvas>
    <div style={{width: props.imageSize+"px", height: "1px", backgroundColor: "#efefef"}}></div>
    <div style={{display: "flex", flexDirection: "column", justifyContent: "center", padding: "10px", width: props.imageSize+"px", boxSizing: "border-box", backgroundColor: THEME.colors.primaryB}}>
      <LabelLarge style={{textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden"}}>
        {name || " "}
      </LabelLarge>
      <ParagraphSmall color={["colorSecondary"]} style={{whiteSpace: "nowrap", overflow:"hidden", textOverflow: "ellipsis", margin: "5px 0px 0px 0px"}}>
        {description || " "}
      </ParagraphSmall>
      <LabelSmall style={{margin: 0, textAlign: "right", marginTop: "5px"}} color={["contentSecondary"]}>
        {isForSale == null ? "Loading" : isForSale == false ? "Not For Sale" : weiStringToEthString(price) + " ETH"}
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

  var card = <>
    <div style={{boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", overflow: "hidden", backfaceVisibility: "hidden", position: "relative", zIndex: "unset", width: "min-content",/* width: imageSize+"px",*/ position: "relative", backgroundColor: "eee"}} ref={cardRef}>
      <div style={{position: "absolute", right: "10px", top: "10px"}}>
        <UserAvatar id={ownerId} size={35} />
      </div>
      {inner}
    </div>
  </>

  return (item != "INVALID" ? card : null)
}

var AvatarAndName = props => {
  var {labelColor, labelStyle, id} = props
  var user = useGetFromDatastore({id, kind:"user"})

  return (
      <div style={{display: "flex", alignItems: "center", whiteSpace: "nowrap"}}>
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

  const {avatarURL, avatarFunction} = useGetFromDatastore({id: props.id, kind: "user"})

  React.useEffect(() => {
    if (avatarFunction) {
      var canvas = canvasRef.current
      var {width, height} = canvas.getBoundingClientRect()
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      avatarFunction(canvas)
    }
  }, [avatarFunction])

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


var Listing = props => {

  // Listing details
  React.useEffect(() => {
    datastore.getItemDetails({id: props.id})
  }, [props.id])

  var isMobile = useMediaQuery([0, 700])
  //TODO: currently canvas object changes when size switches to mobile (so have to rerender in useeffect), would be nice if it didnt.

  var item = useGetFromDatastore({id: props.id, kind: "item"})

  var canvasContainerRef = React.useRef()
  var canvasRef = React.useRef()
  // Game setup and destroy
  React.useEffect(() => {
    if (!item.blocks) {return}
    var animationFrameRequestID
    var renderID
    var voxelRenderer
    var setupGame = async () => {
      var canvas = canvasRef.current
      voxelRenderer = new VoxelRenderer({pixelRatio:1, canvas:canvas})

      var {blocks} = item
      var blockData = ndarray(new Uint8Array(16*16*16*4), [16, 16, 16, 4])
      var blockIDSlice = blockData.lo(0, 0, 0, 0).hi(16, 16, 16, 1)
      np.assign(blockIDSlice, blocks)

      var gameState = new GameState({blocks: blockData})
      var flyControls = new FlyControls({gameState, domElement: canvas, interactionDisabled: true})

      // set initial position
      const lookAtPos = new Vector3(gameState.worldSize.x/2, 8, gameState.worldSize.y/2)
      var orbiter = new AutomaticOrbiter(gameState.camera, {center: lookAtPos.clone(), height: 13, period: 10, radius: 1.5*gameState.worldSize.x/2, lookAtPos})
      orbiter.setRotationToTime(0)

      renderID = voxelRenderer.addTarget({gameState: gameState, element: canvas})
      var tick = timestamp => {
        if (document.hasFocus()) {
          voxelRenderer.renderQueue.unshift(renderID)
          flyControls.externalTick()
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
  }, [props.id, item, isMobile])

  // setting window title
  if (item.name) {document.title = `Polytope | ${item.name}`}

  const viewAreaSize = 500
  var canvasAndControls = <>
    <div style={{position: "relative", zIndex: "1"}} ref={canvasContainerRef}>
      <div style={{position: "absolute", top:"10px", right: "10px"}}>
        <ControlsHelpTooltip hideEditControls/>
      </div>
      <canvas style={{height: "100%", width: "100%"}} ref={canvasRef}/>
    </div>
  </>
  var backArrow =  <>
    <div style={{marginRight: "10px"}}>
      <ArrowLeft size={40} onClick={() => window.history.back()} style={{color: "black", cursor: "pointer"}}/>
    </div>
  </>
  var halfMargin = "28px" // half of theme.sizing.scale1400
  var desktopListing = <>
      <div style={{display: "flex", padding: halfMargin, flexWrap: "wrap", justifyContent: "center"}}>
        <div style={{display: "grid", gridTemplateColumns: "min-content min-content", margin: halfMargin}}>
          {/*TODO: make this accessible */}
          {backArrow}
          <div style={{width: viewAreaSize+"px", height: viewAreaSize+"px", boxShadow: "0px 1px 2px #ccc", borderRadius: "20px", overflow: "hidden", backgroundColor: "#ccc"}}>
            {canvasAndControls}
          </div>
        </div>
        <div style={{margin: halfMargin, flexBasis: "350px", flexGrow: "1"}}>
          <ItemDetailsPanel id={props.id}/>
        </div>
      </div>
  </>
  var mobileListing = <>
      <div style={{display: "flex", flexWrap: "wrap", justifyContent: "center"}}>
        <div style={{width: "100vw", height: "100vw", backgroundColor: "#ccc"}}>
          {canvasAndControls}
        </div>
        <div style={{margin: halfMargin}}>
          <ItemDetailsPanel id={props.id}/>
        </div>
      </div>
  </>


  var html = <>
    <div style={{display: "flex", justifyContent: "center", alignItems: "center"}}>
      {isMobile ? mobileListing : desktopListing}
    </div>
  </>

  return html
}

// owner, hash, buy option, etc.
var ItemDetailsPanel = props => {
  var item = useGetFromDatastore({id: props.id, kind: "item"})

  const viewAreaSize = 500

  // Downloading
  var downloadVox = () => {
    var {blocks} = item
    var gameState = new GameState({blocks})
    var exporter = gameState.toVoxExporter()
    exporter(item.name + ".vox")
  }
  var downloadButton = <>
    <AiOutlineDownload style={{cursor: "pointer", marginLeft: "20px", paddingTop: "5px", color: THEME.colors.colorSecondary,}} title={"Download .vox file"} onClick={downloadVox} size={32} />
  </>

  var owner = useGetFromDatastore({id: item && item.ownerId, kind: "user"})
  var author = useGetFromDatastore({id: item && item.authorId, kind: "user"})

  var userAddress = useGetFromDatastore({kind: "web3Stuff", id: "useraddress"})
  var viewerIsOwner = item.ownerId == userAddress

  var dateCreated = new Date(0)
  dateCreated.setUTCSeconds(item.dateCreated)
  var dateString = "Created " + dateCreated.toLocaleString(undefined, {month: "long", year: "numeric", day: "numeric", hour: "numeric", minute: "numeric"})

  var informationArea = <>
    <div style={{/*width: viewAreaSize+"px",*/flexBasis: "min-content", flexGrow: "1", maxWidth: viewAreaSize + "px", display: "grid", height: "min-content"}}>
      <div style={{display: "flex", alignItems: "center"}}>
        <DisplaySmall>
          {item.name || " "}
        </DisplaySmall>
        {item && item.blocks && viewerIsOwner && downloadButton}
      </div>
      <LabelLarge style={{overflow: "auto", paddingLeft: "2px", marginTop: "25px", minWidth: "0"}} color={["contentSecondary"]}>
        {props.id}
      </LabelLarge>
      <div style={{display: "grid", gridTemplateColumns: "min-content 1fr", alignItems: "center", marginTop: "25px", paddingLeft: "2px", rowGap: "20px", overflow: "hidden", textOverflow: "ellipsis"}}>
        <LabelLarge color={["colorSecondary"]} style={{marginRight: "10px", whiteSpace: "nowrap"}}>
          {"Owner is"}
        </LabelLarge>
        <AvatarAndName id={item.ownerId} labelColor={"colorSecondary"} />
        <LabelLarge color={["colorSecondary"]} style={{marginRight: "10px", whiteSpace: "nowrap", textAlign: "left"}}>
          {"Maker is"}
        </LabelLarge>
        <AvatarAndName id={item.authorId} labelColor={"colorSecondary"} />
      </div>
      <LabelLarge color={["colorSecondary"]} style={{whiteSpace: "nowrap", textAlign: "left",  marginTop: "25px"}}>
        {dateString}
      </LabelLarge>
      <LabelLarge style={{marginTop: "25px", paddingLeft: "2px", lineHeight: "2em", fontWeight: "400"}}>
        {item.description}
      </LabelLarge>
    </div>
  </>

  // Handles all the list / delist / buy stuff
  var [price, setPrice] = React.useState()
  var [waiting, setWaiting] = React.useState()
  var priceBN = ethStringToWei(price)
  var priceValid = !priceBN.isNaN() && priceBN.gt(0)
  var allFieldsValid = priceValid
  var isForSale = item.isForSale

  var bottomFieldStyle = {height: "48px", flexGrow: "1", whiteSpace: "nowrap", boxSizing: "border-box"}

  var onClickViewer = () => buyItemFlow({setWaiting, setError: () => null}, {itemId: item.id, priceBN: BigNumber(item.price)})
  var buyArea = <>
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-around", border: "1px solid #000", ...bottomFieldStyle}}>
        <LabelLarge>{isForSale ? weiStringToEthString(item.price) + " ETH" : "Not For Sale"}</LabelLarge>
      </div>
      {isForSale && <Button kind={KIND.primary} size={SIZE.default} onClick={onClickViewer} style={bottomFieldStyle}>Trade</Button>}
  </>
  var onClickOwner = () => setMarketInfoFlow({setWaiting, setError: () => null}, {isForSale: !isForSale, priceBN, itemId: item.id})

  var setNotForSaleArea = <>
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-around", border: "1px solid #000", ...bottomFieldStyle}}>
        <LabelLarge>{"Listed for " + weiStringToEthString(item.price) + " ETH"}</LabelLarge>
      </div>
      <Button kind={KIND.primary} size={SIZE.default} onClick={onClickOwner} style={bottomFieldStyle}>Remove from market</Button>
  </>
  var setForSaleArea = <>
    <div style={bottomFieldStyle}>
      <Input size={SIZE.default} endEnhancer={"ETH"} onChange={e => setPrice(e.target.value)} error={price && !priceValid}></Input>
    </div>
    <Button style={{/*marginLeft: THEME.sizing.scale600,*/ ...bottomFieldStyle}} kind={KIND.primary} size={SIZE.default} disabled={!allFieldsValid} onClick={onClickOwner} style={{flexGrow: "1"}}>List on market</Button>
  </>
  var waitingArea = <>
    <div style={{display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #000"}}>
      <Spinner size={24}/>
      <LabelLarge style={{marginLeft: THEME.sizing.scale600, height: "48px"}}>
        {waiting}
      </LabelLarge>
    </div>
  </>
  var nonWaitingStuff = viewerIsOwner ? (isForSale ? setNotForSaleArea : setForSaleArea) : buyArea
  var marketArea = <>
    <div style={{display: "flex", height: "min-content", flexWrap: "wrap", marginTop: "25px"}}>
      {waiting ? waitingArea : nonWaitingStuff}
    </div>
  </>

  var html = <>
    <div style={{display: "grid", gridTemplateRows: "min-content 1fr", alignItems: "end", height: "100%"}}>
      {informationArea}
      {marketArea}
    </div>
  </>

  return html
}

var LandingPage = props => {
  var [voxelRenderer, setVoxelRenderer] = React.useState()

  React.useEffect(() => {
    var renderer = new VoxelRenderer({pixelRatio:window.devicePixelRatio})
    setVoxelRenderer(renderer)
    return () => renderer.destroy()
  }, [])

  var [cardItemIds, setCardItemIds] = React.useState([])
  var isWaitingWeb3 = !useGetFromDatastore({kind: "web3Stuff", id: "web3"})
  // can't add [isWaitingWeb3] into React useffect second arg -- doesn't change in func for some reason
  React.useEffect(() => {
    var cancelled = false
    var getDisplayCards = async () => {
      var tokenIds = await datastore.getSorting({type: "random"})
      tokenIds = tokenIds.slice(0, 3)
      !cancelled && setCardItemIds(tokenIds)
    }
    datastore.hasWeb3() && (cardItemIds.length == 0) && getDisplayCards()
    return () => {cancelled = true}
  }, [isWaitingWeb3])

  // card area
  const backgroundColor = "#eee"
  var cards = [...Array(3).keys()].map(idx => {
    var itemId = cardItemIds[idx] || null
    var card = <ListingCard key={itemId || idx} id={itemId} voxelRenderer={voxelRenderer} imageSize={220} />
    var container = <div style={{display: "flex", justifyContent: "center"}}>{card}</div>
    return card
  })
  var web3WaitingScreen = <>
    <div style={{display: "grid", alignItems: "center", justifyItems: "center", with: "100%", backgroundColor}}>
      <div style={{display: "grid", rowGap: THEME.sizing.scale600, justifyItems: "center"}}>
        <Spinner />
        <LabelLarge>Waiting for web3</LabelLarge>
      </div>
    </div>
  </>
  var listingsScreen = <>
    <div style={{backgroundColor: backgroundColor, paddingBottom: THEME.sizing.scale1400, width: "100%", display: "grid", gridTemplateColumns:"repeat(auto-fit, 350px)", gridTemplateRows: "1fr 0 0", justifyItems: "center", justifyContent: "center"}}>
      {cards}
    </div>
  </>
  var isWaitingWeb3 = !useGetFromDatastore({kind: "web3Stuff", id: "web3"})
  var cardArea = isWaitingWeb3 ? web3WaitingScreen : listingsScreen

  // List
  const listItemStyle = {padding: "10px 0px", margin: "0"}
  var numberBox = number => <>
    <HeadingLarge style={{height: "60px", margin: "0", display: "flex", alignItems:"center" }}>
      <div style={{display: "grid", justifyContent: "center", alignContent: "center", backgroundColor: "white", boxShadow: "0px 0px 3px #ccc", width: "1.5em", height: "1.5em", borderRadius: "10%"}}>
          {number}
      </div>
    </HeadingLarge>
  </>
  var listRow = (num, bigText, caption) => <>
    <div style={{display: "flex", alignItems: "start", justifyContent: "start"}}>
      {numberBox(num)}
      <div style={{marginLeft: "1em"}}>
        <HeadingMedium style={listItemStyle} color={["contentSecondary"]}>
          {bigText}
        </HeadingMedium>
        <LabelMedium color={["colorSecondary"]}>{caption}</LabelMedium>
      </div>
    </div>
  </>
  var instructionsList = <>
    <div style={{display: "grid", rowGap: THEME.sizing.scale800}}>
      {listRow(1, <>Create your item in the editor.</>, <>Create an item easily without leaving the browser.</>)}
      {listRow(2, <>Mint the non-fungible token for your item on the ethereum blockchain.</>, <>No two of the <StyledLink href="http://erc721.org/">ERC721</StyledLink> tokens can have the same arrangement of voxels — the token's id is the keccak hash of the voxel grid.</>)}
      {listRow(3, <>Explore and trade for others' items.</>, <>Browse the listings and move around in any item. Or trade on <StyledLink href="https://app.rarible.com/collection/0xe8aa46d8d5565cb7f2f3d9686b0c77f3a6813504">external</StyledLink> <StyledLink href="https://opensea.io/assets/polytope">markets</StyledLink>. </>)}
    </div>
  </>

  var isMobile = useMediaQuery([0, 600])
  var mainMarginSize = isMobile ? "28px" : "56px" // THEME.sizing.scale1400 is 56

  //footer
  var [showMoreBuiltWith, setShowMoreBuiltWith] = React.useState(false)
  var moreButton = <>
    <div style={{display: "inline", textDecoration: "underline", color: "white", cursor: "pointer"}} onClick={() => setShowMoreBuiltWith(true)}>more</div>
  </>
  var expandedMore = <> web3, reach-router, bignumber.js, scijs-ndarray, three, babel, parcel, react-icons, wolframalpha icosahedron, robobo1221, and island joy 16. </>
  var moreArea = showMoreBuiltWith ? expandedMore : moreButton
  const logoImage = require('./logo.svg');
  const licenseLink = (text, link) => <StyledLink style={{color: "white"}} href={link}>{text}</StyledLink>
  var halfMargin = `calc(${mainMarginSize}/2)`
  var footer = <>
    <div style={{display: "flex", justifyContent: "start", padding: halfMargin, backgroundColor: THEME.colors.colorSecondary, alignItems: "center", flexWrap: "wrap"}}>
      <MediaQueryBlock range={[800, null]}>
        <img src={logoImage} height="150px" style={{margin: halfMargin}}/>
      </MediaQueryBlock>
      <div style={{margin: halfMargin}}>
        <HeadingXSmall style={{color: "white", margin: "10px"}}>
          Polytope Inc.
        </HeadingXSmall>
        <HeadingXSmall style={{color: "white", margin: "10px"}}>
          Created by cameronfr.
        </HeadingXSmall>
        <HeadingXSmall style={{color: "white", margin: "0px 10px"}}>
          {"Talk to us on "} {licenseLink("Discord", "https://discord.gg/XfBPAxv")}
        </HeadingXSmall>
        <HeadingXSmall style={{color: "white", margin: "10px"}}>
          {"Built with"}{" "}
          {licenseLink("p5ycho", "https://github.com/kgolid/p5ycho/")},{" "}
          {licenseLink("regl", "https://github.com/regl-project/regl/")},{" "}
          {licenseLink("react", "https://github.com/facebook/react/")},{" "}
          {licenseLink("baseweb", "https://github.com/uber/baseweb/")} and {moreArea}
        </HeadingXSmall>
      </div>
    </div>
  </>

  //buttons to go start
  var buttonMargin = THEME.sizing.scale1000
  var buttonProps = {kind: KIND.default, shape: SHAPE.pill, size: SIZE.large, style: {width: "100%"}}
  var goButton = (text, link) => <>
    <div style={{flexGrow: "1", paddingLeft: buttonMargin, paddingRight: buttonMargin, paddingTop: buttonMargin, maxWidth: "300px"}}>
      <RouterLink to={link}>
        <Button {...buttonProps}>
          <div style={{display: "flex", alignItems: "center", justifyContent: "center"}}>
            {text}
            <ChevronRight size={"2em"}/>
          </div>
        </Button>
      </RouterLink>
    </div>
  </>
  var buttonArea = <>
    <div style={{display: "flex", alignItems: "center", justifyContent: "center", marginTop: `-${buttonMargin}`, flexWrap: "wrap"}}>
      {goButton("Explore Items", "/home")}
      {goButton("Create An Item", "/newItem")}
    </div>
  </>

  const clipPath = "polygon(0 0, 100% 0, 100% 0%, 0% 100%)"

  document.title = `Polytope - Blockchain 3D Voxel Art`
  return <>
    <div style={{display: "grid", paddingLeft: mainMarginSize, paddingRight: mainMarginSize, paddingTop: mainMarginSize, paddingBottom: THEME.sizing.scale1400, backgroundColor: backgroundColor}}>
      <DisplaySmall>
        Create, explore, and trade a new generation of digital items.
      </DisplaySmall>
    </div>
    {cardArea}
    <div style={{clipPath, WebkitClipPath: clipPath, height: "100px", backgroundColor: backgroundColor}}>
    </div>
    <div style={{display: "grid", padding: mainMarginSize, rowGap: THEME.sizing.scale1000}}>
      <HeadingLarge color={["colorSecondary"]} style={{margin: "0"}}>
        Every item is a 3D scene of 16<div style={{display: "inline", position: "relative", top: "-0.7em", "fontSize": "60%"}}>3</div> voxels that can be entered and explored.
      </HeadingLarge>
      <HeadingLarge style={{margin: "0"}}>
        How It Works
      </HeadingLarge>
      {instructionsList}
      <HeadingLarge style={{margin: "0"}}>
        Get Started
      </HeadingLarge>
      {buttonArea}
      <div style={{display: "flex", flexAlign: "center", justifyContent: "center"}}>
        <div style={{borderRadius: "20px", overflow: "hidden", boxShadow: "0px 0px 3px #ccc", height: "45vw", width: "80vw", maxWidth: "680px", maxHeight: "383px"}}>
          <iframe style={{height: "100%", width: "100%"}} src="https://www.youtube.com/embed/eCk2OV6IRnc?mute=1&rel=0" frameBorder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
        </div>
      </div>
      <DisplayXSmall color={["colorSecondary"]} style={{textAlign: "center"}}>
        Polytope's mission is to foster casual creativity by making the act of creation and the exchange of creations easy.
      </DisplayXSmall>
    </div>
    {footer}
  </>
}

// messy
var FeedbackButton = props => {

  var inputRef = React.useRef(null);
  var [isExpanded, setIsExpanded] = React.useState(false)
  var [isHidden, setIsHidden] = React.useState(true)
  var [feedbackText, setFeedbackText] = React.useState("")
  var [feedbackSuccess, setFeedbackSuccess] = React.useState(null)
  var [rollinTimerId, setRollinTimerId] = React.useState(null)

  var rollout = () => {setIsExpanded(true), setIsHidden(false)}
  var rollin = () => {
    setIsExpanded(false),
    setTimeout(() => setIsHidden(true), 0.2*1000)
    setFeedbackText("")
    setFeedbackSuccess(null)
  }

  var inputBackgroundColor = (feedbackSuccess == null) ? "rgb(238, 238, 238)" : (feedbackSuccess ? "rgb(158, 226, 184)" : "rgb(251, 220, 230)")
  const unsetBorder = {borderLeftStyle: "unset", borderBottomStyle: "unset", borderTopStyle: "unset", borderRightStyle: "unset"} // for silencing warning about "border: unset"
  var feedbackInput = <>
    <div style={{transition: "width " + 0.2 + "s ease-in-out", width: isExpanded ? "350px" : "0px"}}>
      <div style={{display: isHidden ? "none" : "unset"}}>
        <Input
          size={SIZE.compact}
          onChange={e => {setFeedbackText(e.target.value); setFeedbackSuccess(null)}}
          value={feedbackText}
          error={feedbackSuccess != null && !feedbackSuccess}
          positive={feedbackSuccess}
          disabled={feedbackSuccess}
          inputRef={inputRef} placeholder={"ideas, problems, questions, etc!"}
          overrides={{InputContainer: {style: {...unsetBorder, height: "36px", backgroundColor: inputBackgroundColor, borderRadius: "0px 15px 15px 0px"}}}}
        />
      </div>
    </div>
  </>
  React.useEffect(() => {isExpanded && inputRef.current && inputRef.current.focus()}, [isExpanded])
  var startFeedbackButton = <Button
    size={SIZE.compact} kind={KIND.secondary}
    style={{color: "black", backgroundColor: "white", width: "180px", borderRadius: isHidden ? "15px" : "15px 0px 0px 15px", boxShadow: "0px 0px 3px #333"}}
    onClick={e => {e.preventDefault(); rollout()}}>
    Feedback and Contact
  </Button>

  var userAddress = useGetFromDatastore({kind: "web3Stuff", id: "useraddress"})
  var submitFeedback = async () => {
    if (feedbackSuccess || !feedbackText) {
      clearTimeout(rollinTimerId)
      rollin()
      return
    }
    var feedbackData = {
      id: userAddress || null,
      feedback: feedbackText,
    }
    datastore.setFeedback(feedbackData).then(res => {
      inputRef.current && inputRef.current.blur()
      setFeedbackSuccess(true)
      setRollinTimerId(setTimeout(rollin, 5000))
    }).catch(e => {
      inputRef.current && inputRef.current.blur()
      setFeedbackSuccess(false)
      console.log(e)
    })
  }

  var submitFeedbackButton = <Button
    size={SIZE.compact} kind={KIND.secondary}
    style={{color: "black", backgroundColor: "white", width: "180px", borderRadius: "15px 0px 0px 15px"}}
    type={"submit"}>
    {feedbackSuccess ? "Submitted" : "Done"}
  </Button>
  var feedbackArea = <>
    <form onSubmit={e => {e.preventDefault(); submitFeedback()}} style={{margin: "0"}}>
      <div style={{display: "flex"}}>
        {!isExpanded ? startFeedbackButton : submitFeedbackButton}
        {feedbackInput}
      </div>
    </form>
  </>

  return feedbackArea
}

var MediaQueryBlock = props => {
  var [isVisible, setIsVisible] = React.useState(false)

  var reevaluateVisibility = () => {
    var width = document.documentElement.clientWidth // innerWidth changes on zoom on mobile
    var range = props.range
    var visible = (range[0] == null || width >= range[0]) && (range[1] == null || width < range[1])
    setIsVisible(visible)
  }

  React.useEffect(() => {
    window.addEventListener("resize", reevaluateVisibility)
    reevaluateVisibility()
    var cleanup = () => window.removeEventListener("resize", reevaluateVisibility)
    return cleanup
  }, [props.range])

  var html = <>
    {props.children}
  </>

  return (isVisible && html)
}

var useMediaQuery = range => {
  var [isWithin, setIsWithin] = React.useState(false)

  var reevaluateVisibility = () => {
    var width = document.documentElement.clientWidth // innerWidth changes on zoom on mobile
    var visible = (range[0] == null || width >= range[0]) && (range[1] == null || width < range[1])
    setIsWithin(visible)
  }

  React.useEffect(() => {
    window.addEventListener("resize", reevaluateVisibility)
    reevaluateVisibility()
    var cleanup = () => window.removeEventListener("resize", reevaluateVisibility)
    return cleanup
  }, [range])

  return isWithin
}

var Header = props => {

  // var searchBefore = (
  //   <div style={{display: 'flex', alignItems: 'center', paddingLeft: THEME.sizing.scale500}}>
  //     <Search size="18px" />
  //   </div>)
  // var searchBar = (
  //   <Input
  //     overrides={{Before: () => searchBefore}}
  //     onChange={() => props.search}
  //     placeholder={"search"}>
  //   </Input>)
  // var onSearchSubmit = e => {
  //   e.preventDefault()
  // }

  var profileArea
  var userAddress = useGetFromDatastore({kind: "web3Stuff", id: "useraddress"})
  if (userAddress) {
    profileArea = <AvatarAndName id={userAddress} labelColor={"colorPrimary"} labelStyle={{maxWidth: "150px", textOverflow: "ellipsis", overflow: "hidden"}}/>
  } else {
    profileArea = <>
      <Button onClick={() => datastore.requestInjectedWeb3()}>Sign In</Button>
    </>
  }

  const farSideMargins = THEME.sizing.scale1400

  // header name -> logo collapsing
  var logoImage = require("./logo.svg")
  var headerLogo = <>
    <div style={{display: "flex", justifyContent: "center", alignItems: "center", height: "64px", width: "64px", boxSizing: "border-box", padding: "5px"}}>
      <div style={{flexGrow: "1", padding: "7px", borderRadius: "100%", boxShadow: "0px 0px 3px #ccc"}}>
        <img src={logoImage}></img>
      </div>
    </div>
  </>
  // only medium +
  var headerName = <>
    <DisplayMedium
    style={{userSelect: "none", cursor: "pointer", paddingLeft: "0"}}>
      Polytope
    </DisplayMedium>
  </>
  const brandingSwapWidth = 880
  var branding = <>
    <RouterLink to={"/"} >
      <MediaQueryBlock range={[brandingSwapWidth, null]}>
        {headerName}
      </MediaQueryBlock>
      <MediaQueryBlock range={[0,brandingSwapWidth]}>
        {headerLogo}
      </MediaQueryBlock>
    </RouterLink>
  </>

  var homeButton = <>
  <RouterLink to={"/home"}>
    <Button kind={KIND.minimal} size={SIZE.default}>
      Home
    </Button>
  </RouterLink>
  </>
  var worldButton = <>
    <RouterLink to={"/world"}>
      <Button kind={KIND.minimal} size={SIZE.default}>
        World
      </Button>
    </RouterLink>
  </>
  var discordButton = <>
  <StyledLink href="https://discord.gg/XfBPAxv" style={{textDecoration: "none"}}>
    <Button kind={KIND.minimal} size={SIZE.default}>
      Discord
    </Button>
  </StyledLink>
  </>
  var createItemButton = <>
  <RouterLink to={"/newItem"}>
    <Button kind={KIND.minimal} size={SIZE.default}>
      Create Item
    </Button>
  </RouterLink>
  </>

  var fullWidthHeader = <>
    <HeaderNavigation style={{backgroundColor: "white"}}>
      <StyledNavigationList $align={ALIGN.left} style={{marginLeft: farSideMargins}}>
        <StyledNavigationItem style={{paddingLeft: "0"}}>
          {branding}
        </StyledNavigationItem>
      </StyledNavigationList>
      <StyledNavigationList $align={ALIGN.center}>
        {/*<StyledNavigationItem style={{width: "100%",  minWidth: "200px", maxWidth: "600px"}}>
          <form onSubmit={() => onSearchSubmit} style={{margin:"0"}}>
            {searchBar}
          </form>
        </StyledNavigationItem>*/}
      </StyledNavigationList>
      <StyledNavigationList $align={ALIGN.right}>
        <StyledNavigationItem style={{paddingLeft: "0px"}}>
          {homeButton}
        </StyledNavigationItem>
        <StyledNavigationItem style={{paddingLeft: "0px"}}>
          {worldButton}
        </StyledNavigationItem>
        <StyledNavigationItem style={{paddingLeft: "0px"}}>
          {discordButton}
        </StyledNavigationItem>
        <StyledNavigationItem style={{paddingLeft: "0px"}}>
          {createItemButton}
        </StyledNavigationItem>
      </StyledNavigationList>
      <StyledNavigationList $align={ALIGN.right} style={{marginRight: farSideMargins}}>
        <StyledNavigationItem>
          {profileArea}
        </StyledNavigationItem>
      </StyledNavigationList>
    </HeaderNavigation>
  </>

  var mobileHeader = <>
    <div style={{backgroundColor: "white", width: "100%", paddingTop: "12px", borderBottom: "1px solid #ccc"}}>
      <div style={{paddingLeft: "15px", paddingRight: "15px", width: "100%", boxSizing: "border-box"}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          {branding}
          {profileArea}
        </div>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          {homeButton}
          {worldButton}
          {discordButton}
          {createItemButton}
        </div>
      </div>
    </div>
  </>

  const headerSwapSize = 760
  var header = <>
    <MediaQueryBlock range={[0, headerSwapSize]}>
      {mobileHeader}
    </MediaQueryBlock>
    <MediaQueryBlock range={[headerSwapSize, null]}>
      {fullWidthHeader}
    </MediaQueryBlock>
  </>


  return header
}

var RouterLink = props => {
  var unstyledLink = <RawRouterLink style={{textDecoration: "none"}} {...props} >
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
      this.shouldRemoveCanvas = true
    } else {
      this.canvas = options.canvas
    }
    this.pixelRatio = options.pixelRatio || 1

    // target scenes to be rendered, see addTarget()
    this.idCounter = 0
    this.targets = []

    this.regl = Regl({
      canvas: this.canvas,
      optionalExtensions: ["EXT_shader_texture_lod"], // guarantees that access to block data will be accurate
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


    const Array2dValueAtIndex = ({indexVar, arrayVar, vertexOrFragment}) => {
      var functionName
      var functionArgs = [arrayVar, `${indexVar}`]
      if (this.regl.hasExtension("EXT_shader_texture_lod")) {
        functionArgs.push("0.0")
        if (vertexOrFragment == "vertex") {
          functionName = "texture2DLod"
        } else if (vertexOrFragment == "fragment") {
          functionName = "texture2DLodEXT"
        } else {
          throw "vertexOrFragment must be string vertex or fragment"
        }
      } else {
        functionName = "texture2D"
      }
      var functionCall = `${functionName}(${functionArgs.join(", ")});`
      return functionCall
    }


    const sharedShaderVariables = `
      uniform sampler2D blocks;
      uniform vec2 viewportSize;
      uniform float topBorderRadius; //hack-y but can't clip abs background
      uniform mat4 invProjection;
      uniform mat4 invView;
      uniform float timeMS;
      uniform sampler2D colorStorage;
      uniform vec3 worldSize;
      const float PI = 3.1415926535;
    `

    // console.log(Array2dValueAtIndex({indexVar: "blockIdxs", shapeVar: "worldSize", arrayVar: "blocks",vertexOrFragment: "vertex"}))

    const sharedShaderFunctions = vertexOrFragment => `
      vec4 blockValueAtIndex(vec3 index) {
        if (clamp(index, vec3(0, 0, 0), worldSize - 1.0 + 0.001) == index) {
          vec2 blockIdxs = vec2(index.x,index.y*worldSize.z + index.z) + vec2(0.5, 0.5);
          vec2 arrayIdxs = blockIdxs/vec2(worldSize.x, worldSize.y*worldSize.z);
          vec4 blockValue = ${Array2dValueAtIndex({arrayVar: "blocks", indexVar: "arrayIdxs", vertexOrFragment})}
          return blockValue;
        } else {
          return vec4(0, 0, 0, -1); //so a=-1 means out of bounds, a=0 means blank block
        }
      }

      vec4 raymarchToBlock(vec3 startPos, vec3 rayDir, out vec3 blockIdx, out vec3 hitPos) {
        const float eps = 0.00001;
        float t = 0.0;
        vec3 rayPos;
        for(int i=0; i<maxRaymarchSteps; i++) {
          rayPos = startPos + rayDir * t;

          vec3 edge = floor(rayPos.xyz);
          vec4 blockValue = blockValueAtIndex(edge);
          bool isNonBlankBlock = blockValue.x > 0.5/255.0;
          // bool isOutOfBoundsBlock = blockValue.x == -1.0;

          if (isNonBlankBlock) {
            blockIdx = edge;
            hitPos = rayPos;
            return blockValue;
          }

          // round down if negative rayDir, round up if positive rayDir
          // need to get distance in direction of ray so sign matters
          vec3 distanceToPlanes = step(vec3(0, 0, 0), rayDir)*(1.0 - fract(rayPos)) + (1.0 - step(vec3(0, 0, 0), rayDir))*(fract(rayPos));

          float safeRaymarchDist = floor(blockValue.b * 255.0 + 0.5);

          vec3 tDeltasToPlanes = distanceToPlanes / abs(rayDir);
          float tDelta = eps + min(tDeltasToPlanes.x, min(tDeltasToPlanes.y, tDeltasToPlanes.z));
          // t += tDelta;
          t += max(safeRaymarchDist, tDelta);
        }

        // default values
        // hitPos = vec3(0, 0, 0);
        hitPos = startPos;
        blockIdx = vec3(0, 0, 0);
        return vec4(0, 0, 0, 0);
      }

      vec3 getCameraDirection(vec2 screenCoord, vec3 cameraPos) {
        vec2 scaledScreenCoord = 2.0 * ((screenCoord / viewportSize.xy) - 0.5); // -1 to 1
        mat4 inverseViewProjection = invView * invProjection;
        vec4 unscaledWorldCoords = inverseViewProjection * vec4(scaledScreenCoord, 0, 1);
        vec3 worldCoords = unscaledWorldCoords.xyz / unscaledWorldCoords.w;
        vec3 rayDir = normalize(worldCoords - cameraPos);
        return rayDir;
      }
    `

    const fragmentShader = `
      ${this.regl.hasExtension("EXT_shader_texture_lod") ? "#extension GL_EXT_shader_texture_lod : enable" : ""}

      precision highp float; // at least on chrome android, unusable without highp

      uniform sampler2D imageTexture;

      ${sharedShaderVariables}

      const int maxRaymarchSteps = 50;
      // const int maxRaymarchSteps = 5;

      ${sharedShaderFunctions("fragment")}

      varying vec3 raymarchStartPos; //from vertex shader fuzzy prediction

      // robobo1221
      vec3 getSky(vec2 uv){
        float atmosphere = sqrt(1.0-uv.y);
        vec3 skyColor = vec3(0.2,0.4,0.8);

        float scatter = pow(0.2,1.0 / 15.0);
        scatter = 1.0 - clamp(scatter,0.8,1.0);

        vec3 scatterColor = mix(vec3(1.0),vec3(1.0,0.3,0.0) * 1.5,scatter);
        return mix(skyColor,vec3(scatterColor),atmosphere / 1.3);
      }
      vec3 getSun(vec3 uvw){
        float sun = 1.0 - distance(uvw,vec3(0.0, 0.6, 0.8));
        sun = clamp(sun,0.0,1.0);
        float glow = sun;
        glow = clamp(glow,0.0,1.0);
        sun = pow(sun,100.0);
        sun *= 100.0;
        sun = clamp(sun,0.0,1.0);
        glow = pow(glow,6.0) * 1.0;
        glow = pow(glow,abs(uvw.y));
        glow = clamp(glow,0.0,1.0);
        sun *= pow(dot(uvw.y, uvw.y),  1.0 / 1.65);
        glow *= pow(dot(uvw.y, uvw.y), 1.0 / 1.5);
        sun += glow;
        vec3 sunColor = vec3(1.0,0.6,0.05) * sun;
        return vec3(sunColor);
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
          if (adjacentBlockVal.x > 0.5/255.0) {
            float dist = length(abs(sideDirs[i]) * abs(adjacentBlockPos + vec3(0.5, 0.5, 0.5) - hitPos)) - 0.5;
            avgDist = opSmoothUnion(avgDist, dist, 0.2);
          }
        }

        for (int i=0; i<4; i++) {
          vec3 adjacentBlockPos = blockIdx + hitNorm + cornerDirs[i];
          vec4 adjacentBlockVal = blockValueAtIndex(adjacentBlockPos);
          if (adjacentBlockVal.x > 0.5/255.0) {
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
        if (ambientOcclusionAlpha < 0.1) {
          ambientOcclusionAlpha = 1.0; // jank patch for bug on rare? graphics cards where alpha is 0 always.
        }
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
        if (FragCoord.y >= viewportSize.y - radius) {
          distanceFromInnerCorner.y = FragCoord.y - (viewportSize.y - radius);
        }
        if (distanceFromInnerCorner.y != -1.0 && distanceFromInnerCorner.x != -1.0  && length(distanceFromInnerCorner) > radius) {
          return true;
        }
        return false;
      }

      void main() {
        vec2 FragCoord = gl_FragCoord.xy;
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

        vec3 cameraPos = (invView * vec4(0, 0, 0, 1)).xyz;
        vec3 rayDir = getCameraDirection(FragCoord, cameraPos);

        // const vec3 lightDir = normalize(vec3(1, -1, 1));
        const vec3 lightDir = normalize(vec3(0, 0.6, 0.8));

        vec3 hitPos;
        vec3 blockIdx;
        // vec4 blockValue = raymarchToBlock(cameraPos, rayDir, blockIdx, hitPos);
        vec4 blockValue = raymarchToBlock(raymarchStartPos, rayDir, blockIdx, hitPos);

        // no block hit
        if (blockValue.x == 0.0) {
          gl_FragColor = vec4(getSky(rayDir.xy) + getSun(rayDir.xyz), 1);
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
        bool shouldDrawEdge = blockValue.a != 0.0;
        // actual bits of a confusing. not 1.0/255.0 on all devices. see blockIdx calculation

        if (false && length(hitDists) > 0.8) {
          gl_FragColor = vec4(0, 0, 0, 1); // corner marks
        } else if (isEdge && shouldDrawEdge) {
          // gl_FragColor = vec4(0.95, 0.95, 0.95, 1); // edge marks
          gl_FragColor = vec4(0, 0, 0, 1); // edge marks
        } else {
          if (dot(hitNorm, -lightDir) < 0.0) {
            reflectRayCosSim = 0.0;
          }
          float blockIdx = floor(blockValue.x * 255.0 + 0.5) - 1.0 + 0.5;
          vec4 blockColor = ${Array2dValueAtIndex({arrayVar: "colorStorage", indexVar: "vec2(blockIdx/16.0, 0.5)", vertexOrFragment: "fragment"})}
          vec3 colorMix  = (0.0*reflectRayCosSim + 0.2*rayNormCosSim + 0.86) * blockColor.rgb * ambientOcclusionAlpha;
          // vec3 colorMix  = blockColor * ambientOcclusionAlpha;
          gl_FragColor = vec4(colorMix, 1);
          // gl_FragColor = vec4(textureCoords, 0.0, 1.0);
          // gl_FragColor = texture2D(imageTexture, textureCoords);
        }
      }
    `

    var vertexShader = `
      ${this.regl.hasExtension("EXT_shader_texture_lod") ? "#extension GL_EXT_shader_texture_lod : enable" : ""}

      precision highp float; // at least on chrome android, unusable without highp

      ${sharedShaderVariables}

      const int maxRaymarchSteps = 50;

      ${sharedShaderFunctions("vertex")}

      attribute vec2 position;

      varying vec4 colorOut;
      varying vec3 raymarchStartPos;

      void main() {
        gl_Position = vec4(position, 0, 1);

        vec2 screenSpaceCoord = ((position / 2.0) + 0.5) * viewportSize.xy;

        vec3 cameraPos = (invView * vec4(0, 0, 0, 1)).xyz;
        vec3 rayDir = getCameraDirection(screenSpaceCoord, cameraPos);

        vec3 hitPos;
        vec3 blockIdx;
        vec4 blockValue = raymarchToBlock(cameraPos, rayDir, blockIdx, hitPos);

        // raymarchStartPos = hitPos - 1.0*rayDir;
        raymarchStartPos = cameraPos;

        // float colorIndex = floor(blockValue.x * 255.0 + 0.5) - 1.0 + 0.5;
        // vec4 blockColor = ${Array2dValueAtIndex({arrayVar: "colorStorage", indexVar: "vec2(colorIndex/16.0, 0.5)", vertexOrFragment: "vertex"})}
        //
        // colorOut = vec4(blockColor.rgb, 1);

      }
    `

    const latticeSize = 2

    this.drawCommand = this.regl({
      frag: fragmentShader,
      // frag: `
      //   precision mediump float;
      //   varying vec4 colorOut;
      //   void main() {
      //     gl_FragColor = colorOut;
      //     // gl_FragColor = vec4(1, 0, 0, 1);
      //   }
      // `,

      vert: vertexShader,

      attributes: {
        position: (context, props) => {
          var points = []
          for (var x=0; x<latticeSize; x++) {
            for (var y=0; y<latticeSize; y++) {
              var xCoord = (x/(latticeSize-1)) * 2 + -1
              var yCoord = (y/(latticeSize-1)) * 2 + -1
              points.push([xCoord, yCoord])
            }
          }
          return this.regl.buffer(points)
        }
      },
      // elements: [[0, 1, 2], [0, 3, 2]],
      elements: (context, props) => {
        var elements = []
        for (var x=0; x<latticeSize-1; x++) {
          for (var y=0; y<latticeSize-1; y++) {
            var idx = x + y*latticeSize
            elements.push([idx, idx+1, idx+latticeSize])
            elements.push([idx+latticeSize, idx+1, idx+latticeSize+1])
          }
        }
        return elements
      },

      uniforms: {
        // This defines the color of the triangle to be a dynamic variable
        blocks: (context, props) => {
          return props.gameState.getBlocksBuffer(this.regl)
        },
        worldSize: (context, props) => {
          const worldSize = props.gameState.worldSize
          return [worldSize.x, worldSize.y, worldSize.z]
        },
        viewportSize: (context) => {
          return ([context.viewportWidth, context.viewportHeight])
        },
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
          var colors = [props.gameState.blockColors.map(c => hexToRGB(c.hex))]
          var colorTexture = (this.colorTexture && this.colorTexture(colors)) || this.regl.texture(colors)
          this.colorTexture = colorTexture
          return colorTexture
        },
        topBorderRadius: (context, props) => (options.topBorderRadius || 0),
      },
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
    this.regl._destroyed = true // needed to prevent double destroy, which regl doesn't like
    this.shouldRemoveCanvas && this.canvas.remove()
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
    this.drawCommand({gameState})
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

    if (globalDebug) {
      this.stats = new Stats();
      this.stats.showPanel(0);
      this.containerRef.current.appendChild(this.stats.dom)
    }

    this.voxelRenderer = new VoxelRenderer({pixelRatio: 1,canvas: this.canvasRef.current, worldSize: this.gameState.worldSize})
    // this.voxelRenderer = new VoxelRenderer({worldSize, topBorderRadius: 14})
    this.renderTargetID = this.voxelRenderer.addTarget({gameState: this.gameState, element: this.canvasRef.current})
    this.controls.externalTick()
    this.voxelRenderer.render(this.renderTargetID)

    const saveIntervalInSeconds = 10
    var frameCount = 0
    var tick = timestamp => {
      if (document.hasFocus()) {
        globalDebug && this.stats.begin()
        this.controls.externalTick()
        this.voxelRenderer.render(this.renderTargetID)
        frameCount % (60 * saveIntervalInSeconds) == 0 && this.saveGameState()
        frameCount += 1
        globalDebug && this.stats.end()
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
    this.gameState.setBlocks(ndarray(new Uint8Array(16 * 17 * 16 * 4), [16,17,16,4]))
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

  render() {
    var sidebar
    if (this.state.atPublishDialog) {
      var onGoBack = () => {
        this.setState({atPublishDialog: false})
        this.controls.interactionEnabled = true
      }
      sidebar = <PublishItemPanel onGoBack={onGoBack} blocks={this.gameState.getRawBlocks()}/>
    } else {
      var onContinue = () => {
        this.setState({atPublishDialog: true})
        this.controls.interactionEnabled = false
      }
      sidebar = <GameControlPanel gameState={this.gameState} reset={()=>this.resetGameState()} onContinue={onContinue} />
    }


    document.title = `Polytope | Create Item`

    return (
      <div style={{width: "100%", height:"100%"}}>
        <div style={{display: "flex", padding: THEME.sizing.scale1400, boxSizing: "border-box", height: "100%", minHeight: "400px", justifyContent: "center"}}>
          <div ref={this.containerRef} style={{flexGrow: "1", boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", overflow: "hidden", position: "relative", zIndex: "unset", minWidth: "200px", maxWidth: "810px", maxHeight: "610px"}}>
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

var WorldMode = props =>  {
  var canvasContainerRef = React.useRef()
  var canvasRef = React.useRef()
  var [currentViewedItem, setCurrentViewedItem] = React.useState()
  var [isLoading, setIsLoading] = React.useState(true)

  var urlParams = new URLSearchParams(location.search);
  var locationId = urlParams.get("id") // same as item id.

  document.title = `Polytope | World`

  var worldUpdateTick = () => {
    //TODO:
    //get current player position
    // update the world (which is e.g. a fixed size of 5x5 chunks), by chopping off the chunks far from player position and adding new chunks
    // make it seamless by updating player position at the same time
  }

  var assembleWorldGrid = async ({gameState}) => {

    var ids = await datastore.getSorting({type: "new"})
    var items = await Promise.all(ids.map(async id => {
      var item = await datastore.getData({id, kind: "item"})
      return item
    }))
    items = items.filter(x => x.blocks) // filter to valid items
    locationId = locationId || items[0].id

    var mapSizeChunks = Math.ceil(Math.sqrt(items.length)) // number of chunks per side

    var itemSize = 16
    var roadSize = 2
    var worldWidth = (itemSize+roadSize) * mapSizeChunks + roadSize
    var worldSize = new Vector3(worldWidth, itemSize+1, worldWidth)
    var worldBlocks = (new WorldGenerator({worldSize})).bottomPlate().blocks
    // ids = ids.slice(0, 25)
    // disable optimization while stuff is loading in (or will look glitchy)
    gameState.resetCubeRaymarchOptimization()
    var updates = items.map(async (item, currentIdx) => {
      // var item = await datastore.getData({id, kind: "item"})
      var chunkIdx = [Math.floor(currentIdx / mapSizeChunks), currentIdx % mapSizeChunks]
      var chunkPos = chunkIdx.map(idx => roadSize + (itemSize+roadSize)*idx)
      if (item.blocks) {
        // item id from listing not necessarily valid -- i.e. might contain no blocks bcz invalid
        var currentSlice = worldBlocks.lo(chunkPos[0], 1, chunkPos[1], 0).hi(...item.blocks.shape)
        np.assign(currentSlice, item.blocks)
      }
      if (item.id == locationId) {
        var eps = 0.11
        gameState.position.set(eps +chunkPos[0]- roadSize/2, 2, eps + chunkPos[1] - roadSize/2)
        gameState.camera.lookAt(new Vector3(chunkPos[0] + itemSize/2, itemSize/2, chunkPos[1] + itemSize/2))
        setCurrentViewedItem(item)
      }
      var roadSlice = worldBlocks.lo(chunkPos[0]-roadSize, 0, chunkPos[1]-roadSize,0).hi(itemSize+2*roadSize, 1, itemSize+2*roadSize, 1)
      // move to worldgen? make worldgen work on slices?
      for (var x =0; x<roadSlice.shape[0]; x++) {
        for (var y=0; y<roadSlice.shape[1]; y++) {
          for(var z=0; z<roadSlice.shape[2]; z++) {
            var color = Math.random() < 0.2 ? 14 : 16
            roadSlice.set(x, y, z, 0, color)
          }
        }
      }
      var centerSlice = worldBlocks.lo(chunkPos[0], 0, chunkPos[1], 0).hi(itemSize, 1, itemSize, 1)
      np.assigns(centerSlice, 1)
    })

    var coordsToItemId = coords => {
      var tileSize = itemSize+roadSize
      var chunkIdx = [Math.floor(coords[0]/tileSize), Math.floor(coords[1]/tileSize)]
      var notOnRoad = (coords[0] % tileSize > roadSize) && (coords[1] % tileSize > roadSize)
      if (!notOnRoad) {
        return undefined
      }
      var index = chunkIdx[0] * mapSizeChunks + chunkIdx[1]
      var item = items[index]
      return item
    }
    await Promise.all(updates)
    // update cube preoptimization map
    gameState.setBlocks(worldBlocks)

    return {coordsToItemId}

  }

  React.useEffect(() => {
    var cleanupFunctions = []
    var eventListeners = []
    var addEventListener = (obj, eventName, func) => {
      eventListeners.push([obj, eventName, func])
      obj.addEventListener(eventName, func)
    }
    cleanupFunctions.push(() => {
      eventListeners.forEach(([obj, eventName, func]) => obj.removeEventListener(eventName, func))
    })

    var canvas = canvasRef.current

    var camera = new PerspectiveCamera(95, 1.0, 0.1, 1000)
    camera.position.set(0.01 + 10/2, 10, 0)
    camera.lookAt(new Vector3(8, 8, 8))

    var tmpBlocks = (new WorldGenerator({worldSize: new Vector3(1,1,1)})).blocks
    var gameState = new GameState({blocks: tmpBlocks, camera})
    var coordsToItemId
    assembleWorldGrid({gameState}).then(ret => {
      coordsToItemId = ret.coordsToItemId
      setIsLoading(false)
    })
    var controls = new FlyControls({gameState, domElement: canvas, interactionDisabled: true, flyDisabled: true})

    var resizeCamera = () => {
      const { height, width } = canvas.getBoundingClientRect();
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resizeCamera()
    addEventListener(window, "resize", () => resizeCamera())

    if (globalDebug) {
      var stats = new Stats();
      stats.showPanel(0);
      canvasContainerRef.current.appendChild(stats.dom)
    }

    var voxelRenderer = new VoxelRenderer({pixelRatio: 1,canvas, worldSize: gameState.worldSize})
    cleanupFunctions.push(() => voxelRenderer.destroy())
    var renderTargetID = voxelRenderer.addTarget({gameState, element: canvas})
    controls.externalTick()
    voxelRenderer.render(renderTargetID)

    var destroyed = false
    cleanupFunctions.push(() => {destroyed = true})
    var frameCount = 0
    var animationFrameRequestID
    var lastItem // can't use react state here
    var tick = timestamp => {
      if (document.hasFocus() && !destroyed) {
        globalDebug && stats.begin()
        if (frameCount % 30 == 0) {
          if (coordsToItemId) {
            var item = coordsToItemId([camera.position.x, camera.position.z])
            if ((!lastItem && item) || (item && item.id != lastItem.id)) {
              lastItem = item
              setCurrentViewedItem(item)
              urlParams.set("id", item.id)
              window.history.replaceState({}, '', `${location.pathname}?${urlParams}`);
            }
          }
        }
        controls.externalTick()
        voxelRenderer.render(renderTargetID)
        frameCount += 1
        globalDebug && stats.end()
      }
      animationFrameRequestID = window.requestAnimationFrame(tick)
    }
    animationFrameRequestID = window.requestAnimationFrame(tick)

    var cleanup = () => cleanupFunctions.forEach(f => f())
    return cleanup
  }, [])

  var itemInfoArea = <>
    <ItemDetailsPanel id={currentViewedItem && currentViewedItem.id} />
    {/* <ItemDetailsPanel id={"0xffaf0c3efb3d05f06348c9b6ab5c3f76ae8c771411de57a74abb653d78d8f263"} /> */}
  </>
  var label
  var loadingInfoPanel = <>
    <div style={{maxWidth: "300px", display: "grid", rowGap: THEME.sizing.scale1000, gridTemplateRows: "min-content min-content"}}>
      <DisplaySmall>World</DisplaySmall>
      <LabelLarge color={["colorSecondary"]} style={{lineHeight: "2em", fontWeight: "400"}}>The world is currently loading. This may take a couple of seconds.</LabelLarge>
      <LabelLarge color={["colorSecondary"]} style={{lineHeight: "2em", fontWeight: "400"}}>Polytope World is a space full of works by artists on Polytope.</LabelLarge>
    </div>
  </>

  var html = <>
    <div style={{width: "100%", height:"100%"}}>
      <div style={{display: "grid", gridTemplateColumns: "minmax(100px, 810px) 320px", padding: THEME.sizing.scale1400, columnGap: THEME.sizing.scale1400, height: "100%", boxSizing: "border-box", justifyContent: "center", maxHeight: "700px"}}>
        <div ref={canvasContainerRef} style={{boxShadow: "0px 1px 2px #ccc", borderRadius: "14px", overflow: "hidden", position: "relative", zIndex: "unset", minWidth: "200px", maxWidth: "810px", maxHeight: "610px", height: "100%"}}>
          <div style={{position: "absolute", top:"10px", right: "10px"}}>
            <ControlsHelpTooltip hideEditControls hideFly/>
          </div>
          <div style={{position: "absolute", top:"10px", left: "10px"}}>
            {isLoading && <Spinner size={"32px"}/>}
          </div>
          <canvas style={{width: "100%", height: "100%"}} ref={canvasRef}/>
        </div>
        {currentViewedItem ? itemInfoArea : loadingInfoPanel}
      </div>
    </div>
  </>

  return html
}

class WorldGenerator {
  constructor({worldSize, blocks}) {
    if (worldSize) {
      const worldShape = [worldSize.x, worldSize.y, worldSize.z, 4]
      const numBlocks = worldShape.reduce((a, b) => a*b, 1)
      this.blocks = ndarray(new Uint8Array(numBlocks), worldShape)
      np.assigns(this.blocks, 0)
    } else if (blocks) {
      this.blocks = blocks
    } else {
      throw "need worldSize or blocks"
    }
    return this
  }

  bottomPlate(blockID) {
    var bottomSlice = this.blocks.lo(0, 0, 0, 0).hi(this.blocks.shape[0], 1, this.blocks.shape[2], 1)
    var blockID = blockID == undefined ? 1 : blockID
    np.assigns(bottomSlice, blockID)

    return this
  }

  colorStripe() {
    for (var z = 0; z < this.blocks.shape[2]; z++) {
      this.blocks.set(1, 1, z, 0, z)
    }
    return this
  }

  clear() {
    np.assigns(this.blocks, 0)
    return this
  }

  // puts random color rand size prism on floor flate
  // working with nddaray-ops not easy
  randomRectangularPrism({seed}) {
    var randomGen = RandomGen.create(seed)

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

    var randomColor = Math.floor(randomGen.random() * 16) * 1
    var prismSlice = this.blocks.lo(...startCornerPos.data, 0).hi(...widths.data, 1)
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
    this.setBlocks(options.blocks)

    this.camera = options.camera || this.defaultCamera()

    if (options.playerState) {
      this.camera.position.copy(options.playerState.position)
      this.camera.rotation.copy(options.playerState.rotation)
    }

    // RESETS CAMERA. TODO: remove this
    this.camera.quaternion.setFromAxisAngle(new Vector3(0, 0, 0), 0)
    this.camera.lookAt(new Vector3(8,0,8))
    this.camera.updateWorldMatrix()

    this.position = this.camera.position
  }

  getBlocksBuffer(regl) {
    // Passed regl from renderer. If regl changes for a given gameState, bad thing will happen
    if (!this.blockBuffer) {
      this.regl = regl
      const worldSize = this.worldSize
      // .data does not change for a slice, so passing scijs slices as data here won't work
      var blocksReshape = ndarray(this.blocks.data, [worldSize.x, worldSize.y*worldSize.z, 4])
      var blocksTexture = regl.texture(blocksReshape)
      this.blockBuffer = blocksTexture
    }
    return this.blockBuffer
  }

  destroy() {
    this.regl && this.blockBuffer && !this.regl._destroyed && this.blockBuffer.destroy()
  }

  setBlocksData(x, y, z, i, val) {
    const worldSize = this.worldSize
    this.blocks.set(x, y, z, i, val)
    // this.blockBuffer = undefined // force blockbuffer to be rebuilt when getBlocksBuffer is called
    // If do above, will cause rebuilding every time block selection changes
    if (this.blockBuffer) {
      var newPixel = []
      for (var j=0; j<4; j++) {
        if (i == j) {
          newPixel.push(val)
        } else {
          newPixel.push(this.blocks.get(x, y, z, j))
        }
      }
      this.blockBuffer.subimage({width: 1, height: 1, data:newPixel}, x, y*worldSize.z + z)
    }
  }

  // precomputing how far we can send a ray from a given voxel.
  updateCubeRaymarchDistances() {
    var generateSummedAreaTable = (array4d) => {
      var shape = array4d.shape.slice(0, 3)
      var SATArray = ndarray(new Uint16Array(shape[0]*shape[1]*shape[2]), shape) // note max here

      var SAT = (x, y, z) => {
        if (x < 0 || y < 0 || z < 0) {
          return 0
        } else {
          return SATArray.get(x, y, z)
        }
      }

      for (var x=0; x<shape[0]; x++) {
        for (var y=0; y<shape[1]; y++) {
          for (var z=0; z<shape[2]; z++) {
            var isBlock = array4d.get(x, y, z, 0) != 0 ? 1 : 0
            // Because each SAT arg coord is less than the current x, y, or z, we know the loop must've already hit it.
            var newVal = isBlock + SAT(x-1,y-1,z-1) + SAT(x, y, z-1) + SAT(x, y-1, z) + SAT(x-1, y, z) - SAT(x-1, y-1, z) - SAT(x, y-1, z-1) - SAT(x-1, y, z-1)
            SATArray.set(x, y, z, newVal)
          }
        }
      }
      return SATArray
    }

    var SAT = generateSummedAreaTable(this.blocks)

    // going by cube "radius -- e.g. min dist(x,y,z) from center block
    var smallestEmptyCubeSize = (index, startLow, startHigh) => {
      var cubeBlockCount = r => {
        var S = (x, y, z) => {
          if (x < 0 || y < 0 || z < 0) {return 0}
          else {return SAT.get(x, y, z)}
        }
        var [x1, y1, z1] = [index[0]-r-1, index[1]-r-1, index[2]-r-1]
        var [x2, y2, z2] = [index[0]+r, index[1]+r, index[2]+r]
        var count = S(x2,y2,z2) - S(x2,y2,z1) - S(x2,y1,z2) - S(x1,y2,z2) + S(x1,y1,z2) + S(x1,y2,z1) + S(x2,y1,z1) - S(x1,y1,z1)
        return count
      }

      if (startLow == startHigh - 1 || startLow == startHigh) {
        return startLow
      }

      var middle = Math.floor((startLow + startHigh) / 2) // bias low so middle on inner side of border wins
      var midCubeSize = cubeBlockCount(middle)
      // low 0 high 1
      // middle 0
      // console.log(startLow, middle, startHigh)
      // console.log("mid cube size", midCubeSize, "at mid rad", middle)
      var r = middle

      if (midCubeSize > 0) {
        return smallestEmptyCubeSize(index, startLow, middle)
      } else if (midCubeSize == 0) {
        return smallestEmptyCubeSize(index, middle, startHigh)
      }
    }

    var shape = this.blocks.shape

    // var dists = []

    for (var x=0; x<shape[0]; x++) {
      for (var y=0; y<shape[1]; y++) {
        for (var z=0; z<shape[2]; z++) {
          var safeRaymarchDist = smallestEmptyCubeSize([x, y, z], 0, Math.min(x, y, z, shape[0]-x-1, shape[1]-y-1, shape[2]-z-1))
          // dists.push(safeRaymarchDist)
          this.setBlocksData(x, y, z, 2, safeRaymarchDist)
        }
      }
    }
    // dists.sort()
    // console.log(dists) //mainly lots of threes. because of the chunk size, most are gonna be close to sides.
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

  // removes build plate. and only takes block dim of vec4
  getRawBlocks() {
    var validSlice = this.blocks.lo(0, 1, 0, 0).hi(16, 16, 16, 1)
    var publishableBlocks = ndarray(new Uint8Array(16*16*16*1), [16, 16, 16, 1])
    np.assign(publishableBlocks, validSlice)
    return publishableBlocks
  }

  toVoxExporter() {
    var exporter = new VoxExporter(16, 16, 16)
    var rawBlocks = this.getRawBlocks()
    // set blocks
    for (var x = 0; x < rawBlocks.shape[0]; x++) {
      for (var y = 0; y < rawBlocks.shape[0]; y++) {
        for (var z = 0; z < rawBlocks.shape[0]; z++) {
            var colorIndex = rawBlocks.get(x, y, z, 0)
            exporter.setVoxel(16-x-1, z, y, colorIndex) // magicaVoxel coords are diff
        }
      }
    }
    // set palette
    this.blockColors.map(colorItem => {
      var colorHex = colorItem.hex.slice(1, colorItem.hex.length)
      colorHex = "0x00" + colorHex // add alpha channel
      exporter.palette[colorItem.id-1] = parseInt(colorHex, 16)
    })

    var exportFunction = filename => exporter.export(filename)
    return exportFunction
  }

  // sometimes want to do stuff manually
  resetCubeRaymarchOptimization() {
    var shape = this.blocks.shape
    for (var x=0; x<shape[0]; x++) {
      for (var y=0; y<shape[1]; y++) {
        for (var z=0; z<shape[2]; z++) {
          this.setBlocksData(x, y, z, 2, 0)
        }
      }
    }
  }

  // has to be called when setting this.blocks
  setBlocks(blocks) {
    this.blockBuffer = undefined // force blockbuffer to be rebuilt when getBlocksBuffer is called
    this.blocks = blocks
    this.updateCubeRaymarchDistances(blocks)
    this.worldSize = new Vector3(...this.blocks.shape.slice(0, 3))
  }

  // Expects cube sans floor plate
  setAllBlocks(rawBlocks) {
    var blocks = ndarray(new Uint8Array(16*17*16*4), [16, 17, 16, 4])
    var nonFloorSlice = blocks.lo(0, 1, 0, 0).hi(16, 16, 16, 1)
    np.assign(nonFloorSlice, rawBlocks)
    this.setBlocks(blocks)
  }

  //serializes a slice, used as input to hash.  e.g. lo=[0, 1, 0] hi=[16, 16, 16]
  serializeBlockData(lo, hi) {
    var slice = this.blocks.lo(lo).hi(hi)
  }

  blockExists(pos) {
    if (!this.withinWorldBounds(pos)) {
      return false
    }
    let exists = this.blocks.get(pos.x, pos.y, pos.z, 0) != 0
    return exists
  }

  addBlock(pos, id) {
    this.setBlocksData(pos.x, pos.y, pos.z, 0, id)
    this.updateCubeRaymarchDistances(this.blocks)
  }

  removeBlock(pos, id) {
    this.setBlocksData(pos.x, pos.y, pos.z, 0, 0)
    this.updateCubeRaymarchDistances(this.blocks)
  }

  toggleBlockOutline(pos, status) {
    this.setBlocksData(pos.x, pos.y, pos.z, 3, status ? 1 : 0)
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
    var debugSteps = 0
    while(t < maxDist) {
      debugSteps += 1
      var blockPos = rayPos.clone().floor()
      if (this.blockExists(blockPos)) {
        var hitPos = rayPos
        return [blockPos, hitPos]
      }
      var timeToPlaneX = ((dirVec.x > 0) ? (1 - fract(rayPos.x)) : fract(rayPos.x)) / Math.abs(dirVec.x)
      var timeToPlaneY = ((dirVec.y > 0) ? (1 - fract(rayPos.y)) : fract(rayPos.y)) / Math.abs(dirVec.y)
      var timeToPlaneZ = ((dirVec.z > 0) ? (1 - fract(rayPos.z)) : fract(rayPos.z)) / Math.abs(dirVec.z)
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
    this.gameState.setBlocks(gen.blocks)
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
    var magicaVoxelTemplatePath = require("./MagicaVoxelTemplate.vox")
    var importTooltipMessage = <>
      <div style={{width: "200px"}}>
        The voxels size must be 16x16x16. Colors will be converted to the nearest color on the above palette. Download a template <StyledLink href={magicaVoxelTemplatePath} style={{color:"white", textDecoration: "underline", outline: "none"}}>here</StyledLink>. More flexibility will be added soon!
      </div>
    </>

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
        <div style={{color: THEME.colors.colorSecondary, fontSize: "12px", lineHeight: "20px", fontFamily: THEME.typography.LabelSmall.fontFamily, margin: "1em 0 1em 0"}}>
          <TextWithHelpTooltip text={"Import a .vox file from MagicaVoxel."}
            tooltipMessage={importTooltipMessage}
          />
        </div>
        <VoxImporterButton gameState={this.props.gameState}/>
        <Caption1>
          Continue to minting item
        </Caption1>
        <Button size={SIZE.compact} kind={KIND.primary} onClick={this.props.onContinue}>Continue</Button>
      </div>
    )
  }
}

var VoxImporterButton = props => {
  var [fileSelector, setFileSelector] = React.useState()

  var closestGameColorIndex = inRgb => {
    var gameColors = props.gameState.blockColors.map(colorItem => {
      var rgb = hexToRGB(colorItem.hex)
      var distance = (rgb[0]-inRgb[0])**2 + (rgb[1]-inRgb[1])**2 + (rgb[2]-inRgb[2])**2
      return ({id: colorItem.id, distance})
    })
    gameColors.sort((a, b) => (a.distance < b.distance ? -1 : 1))
    return gameColors[0].id
  }

  var setBlocksFromParsedFile = parsedFile => {
    var size = parsedFile.SIZE
    var palette = parsedFile.RGBA

    if (size.x != 16 || size.y != 16 || size.z != 16) {
      toaster.warning(`The .vox size must be 16^3! This requirement will be relaxed in the future.`)
      return
    }
    var rawBlocks = ndarray(new Uint8Array(size.x*size.y*size.z), [size.x,size.y,size.z,1])

    var indexedBlocks = parsedFile.XYZI
    indexedBlocks.forEach(entry => {
      var {x, y, z, c} = entry
      if (c != 0) {
        var rgb = ["r", "g", "b"].map(i => palette[c-1][i])
        var colorIndex = closestGameColorIndex(rgb)
        rawBlocks.set(size.x-x-1, z, y, 0, colorIndex) //magicavoxel coords are diff
      }
    })
    props.gameState.setAllBlocks(rawBlocks)
  }

  var onSelectorChanged = (fileSelector) => {
    var file = fileSelector.files[0]
    var reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = function(){
      var fileBuffer = reader.result;
      var parsedFile = voxImport(fileBuffer)
      var blocks = setBlocksFromParsedFile(parsedFile)
    };
    fileSelector.value = null //needed to get change event to fire again
  }

  var buildFileSelector = () => {
    const fileSelector = document.createElement("input");
    fileSelector.setAttribute("type", "file");
    fileSelector.setAttribute("accept", ".vox");
    fileSelector.addEventListener("change", e => onSelectorChanged(fileSelector));
    return fileSelector;
  }

  React.useEffect(() => {
    setFileSelector(buildFileSelector())
  }, [])

  var html = <>
    <Button size={SIZE.compact} kind={KIND.secondary} onClick={e => fileSelector && fileSelector.click()} >
      Import Vox File
    </Button>
  </>

  return html
}

var PublishItemPanel = props => {
  var [voxelRenderer, setVoxelRenderer] = React.useState()

  React.useEffect(() => {
    var renderer = new VoxelRenderer({pixelRatio:window.devicePixelRatio})
    setVoxelRenderer(renderer)
    var cleanup = () => {renderer.destroy()}
    return cleanup
  }, [])

  // form fields
  var [price, setPrice] = React.useState("")
  var [name, setName] = React.useState("")
  var [description, setDescription] = React.useState("")
  var [forSale, setForSale] = React.useState(false)

  // Save some fields in localstorage
  React.useEffect(() => {
    var savedState
    try {
      savedState = JSON.parse(window.localStorage.getItem("publishItemPanelState"))
      setForSale(savedState.forSale)
      setPrice(savedState.price)
      setName(savedState.name)
      setDescription(savedState.description)
    }
    catch(e) {
      console.log(e)
    }
  }, [])
  React.useEffect(() => {
    var saveDict = {forSale, price, name, description}
    window.localStorage.setItem("publishItemPanelState", JSON.stringify(saveDict))
  })

  var priceBN = ethStringToWei(price)
  var web3 = useGetFromDatastore({kind: "web3Stuff", id: "web3"})
  var userAddress = useGetFromDatastore({kind: "web3Stuff", id: "userAddress"})
  var mintItem = async () => {
    try {
      if (!web3 || !userAddress) {
        var granted = await datastore.requestInjectedWeb3()
        if (!granted) throw "Web3 is needed to mint"
        web3 = await datastore.getData({kind: "web3Stuff", id: "web3"})
        userAddress = await datastore.getData({kind: "web3Stuff", id: "userAddress"})
      }

      var rawBlocks = Array.from(props.blocks.data)
      var blocksHash = keccakUtf8(JSON.stringify(rawBlocks))
      var metadata = {name, description, blocks: rawBlocks}
      // note that second arg to JSON.stringify will guarantee order but will get rid of nested obj
      var metadataHash = keccakUtf8(JSON.stringify(metadata, ["name", "description", "blocks"]))

      setWaiting("Uploading metadata to server")
      await runWithErrMsgAsync(datastore.setItemData({metadata, metadataHash, id: blocksHash}), "Error uploading metadata")

      setWaiting("Please approve the mint transaction")

      var mintTransaction = (await datastore.mintToken({tokenId: blocksHash, metadataHash, userAddress})).send
      var mintPromise = new Promise((resolve, reject) => {
        mintTransaction.on("transactionHash", hash => {
          setWaiting("Waiting for confirmations")
        }).on("receipt", async (receipt) => {
          resolve(receipt.transactionHash)
        }).on("error", (error, receipt) => {
          // since can't see revert message, have to hope these are only errors
          var error
          if (receipt && receipt.status != undefined) {
            var tokenLink = <>
              <RouterLink style={{textDecoration: "underline", color: "unset"}} to={`/item/${blocksHash}`}>here</RouterLink>
            </>
            error = <>Token already exists {tokenLink}!</>
          } else if (receipt) {
            error = "Not enough Gas"
          } else {
            error = "Error starting contract call" //prob rejected
          }
          reject(error)
        })
      })

      var transactionHash = await mintPromise
      if (forSale) {
        await setMarketInfoFlow({setWaiting, setError: () => null}, {isForSale: forSale, priceBN, itemId: blocksHash})
      }
      setSuccess({blocksHash, transactionHash})

    } catch(e) {
      setNotification(e)
      setWaiting("")
    }
  }

  var [waiting, setWaiting] = React.useState("")
  var [notification, setNotification] = React.useState("")
  var [success, setSuccess] = React.useState(false)
  var waitingHtml = <>
    <div style={{display: "grid", rowGap: THEME.sizing.scale600, justifyItems: "center", margin: THEME.sizing.scale600 + " 0px"}}>
      <Spinner />
      <LabelMedium style={{textAlign: "center"}}>{waiting}</LabelMedium>
    </div>
  </>
  var notificationHtml = notification ? <Notification kind={NotificationKind.warning} overrides={{Body: {style: {width: 'auto'}}}}>{() => notification}</Notification> : null
  var successHtml = <>
    <div style={{display: "grid", rowGap: THEME.sizing.scale600, justifyItems: "center"}}>
      <div style={{display: "flex", justifyContent: "center", alignItems: "center"}}>
        <div style={{display: "flex", alignItems: "center", justifyContent: "center", width: "60px", height: "60px", borderRadius: "100%", boxShadow: "0px 0px 3px #ccc", backgroundColor: THEME.colors.positive, margin: THEME.sizing.scale600 + " 0px"}}>
          <Check size={80} color={["white"]}></Check>
        </div>
        <LabelLarge style={{marginLeft: THEME.sizing.scale600}}>Token Minted</LabelLarge>
      </div>
      <a style={{width: "100%", textDecoration: "none"}} href={`https://etherscan.io/tx/${success.transactionHash}`}>
        <Button style={{width: "100%"}} size={SIZE.compact} kind={KIND.secondary}>
          View on Etherscan
        </Button>
      </a>
      <RouterLink style={{width: "100%"}} to={`/item/${success.blocksHash}`}>
        <Button style={{width: "100%"}} size={SIZE.compact} kind={KIND.primary}>
          Go to Item
        </Button>
      </RouterLink>
    </div>
  </>

  var caption = (text, errorText, isError) => <>
      <Caption1 color={isError ? ["negative400"] : undefined}>
        {isError ? errorText : text}
      </Caption1>
    </>

  var priceValid = price && !priceBN.isNaN() && priceBN.gte(0)
  var nameValid = name //name && (/^[a-zA-Z0-9 ]+$/).test(name) // still want emoji
  var descriptionValid = description//name && (/^[a-zA-Z0-9 ]+$/).test(description)
  var allInputValidated = (!forSale || priceValid) && nameValid && descriptionValid

  var priceArea = <>
    <div style={{display: "grid", gridTemplateColumns: "min-content 1fr", whiteSpace: "nowrap", alignItems: "center", columnGap: THEME.sizing.scale600}}>
      <Checkbox checked={forSale} onChange={e => setForSale(e.target.checked)} labelPlacement={LABEL_PLACEMENT.right}>
        For sale
      </Checkbox>
      <div style={{visibility: forSale ? "unset" : "hidden"}}>
        <Input size={SIZE.compact} placeholder={"price"} value={price} onChange={e => setPrice(e.target.value)} endEnhancer={"ETH"} error={price && !priceValid} inputMode={"decimal"} />
      </div>
    </div>
  </>

  var formArea = <>
    <LabelMedium>
      Mint
    </LabelMedium>
    <div style={{marginTop: "20px"}}>{notificationHtml}</div>
    {caption("Name of the item (required)", "Name can only have letters and numbers", name && !nameValid)}
    <Input size={SIZE.compact} placeholder={"Item name"} value={name} onChange={e => setName(e.target.value)} />
    {caption("Description for the item (required)", "Description can only have letters and numbers", description && !descriptionValid)}
    <Input size={SIZE.compact} placeholder={"Item description"} value={description} onChange={e => setDescription(e.target.value)} />
    <Caption1>
      Whether to list on the store. You can always change this later.
    </Caption1>
    {priceArea}
    <Caption1>
      See a preview of your item below
    </Caption1>
    <div style={{display: "flex", justifyContent: "center", marginBottom: "1em"}}>
      <ListingCard listingData={{blocks: props.blocks, name: name, price: ethStringToWei(price), isForSale: forSale, description: description, ownerId: userAddress}} voxelRenderer={voxelRenderer} imageSize={220} autoOrbit />
    </div>
    <div style={{display: "grid", gridAutoColumn: "1fr", gridAutoFlow: "column", columnGap: THEME.sizing.scale600}}>
      <Button size={SIZE.compact} kind={KIND.secondary} onClick={props.onGoBack}> Go back </Button>
      <Button size={SIZE.compact} kind={KIND.primary} onClick={mintItem} disabled={!allInputValidated}>Mint</Button>
    </div>
  </>


  return <>
    <div style={{display: "grid", gridTemplateColumns: "1fr", height: "min-content", width: "250px"}}>
      {success ? successHtml : (waiting ? waitingHtml : formArea)}
    </div>
  </>
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
      var timeout1 = window.setTimeout(() => this.setState({disabledDuringConfirmation: false}), 1000)
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
    var f = this.keyRect("f", keyHeight )
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
          {!this.props.hideFly && <>{f} {this.centeredLabel("toggle walking")}</>}
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
    this.flying = options.flyDisabled? false : true

    this.listeners = []
    this.addEventListener(window, "keydown", e => {
      this.capturingMouseMovement && e.preventDefault()
      this.capturingMouseMovement && this.updateKeystates(e.key, true)
      e.key == "e" && this.toggleMouseCapture()
      e.key == "f" && !options.flyDisabled && this.toggleFlying()
    })
    this.addEventListener(window, "keyup", e => {
      this.capturingMouseMovement && this.updateKeystates(e.key, false)
    })
    this.addEventListener(this.domElement, "mousedown", e => {
      if (e.button == 0) { // left click
        if (!this.capturingMouseMovement) {
          this.domElement.requestPointerLock()
        } else {
          this.clickBuffer.click += 1
        }
      } else if (e.button == 2 && this.capturingMouseMovement) {
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
    var lastTouch
    this.addEventListener(this.domElement, "touchmove", e => {
      e.preventDefault()
      var touch = e.touches[0]
      if (lastTouch && touch && lastTouch.identifier == touch.identifier) {
        var movementX = touch.pageX - lastTouch.pageX
        var movementY = touch.pageY - lastTouch.pageY
        this.updateMouseBuffer(movementX, movementY)
      }
      lastTouch = touch
    })
    this.addEventListener(this.domElement, "touchend", e => {
      lastTouch = null
    })

    this.keyState = {}
    this.mouseMoveBuffer = {x: 0, y: 0}
    this.clickBuffer = {click: 0, rightClick: 0}
    this.captureMouseMovement = false

    // Configuration for fly
    this.flyConfig = {
      maxVelocity: 0.2,
      timeToReachMaxSpeed: 0.6,
      timeToReachZeroSpeed: 0.2,
    }
    // Configuration for walk coded in the function

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

  toggleFlying() {
    this.flying = !this.flying
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
      var newBlockPos
      if (raymarchResult) {
        var [blockPos, hitPos] = raymarchResult
        var [normal, dim] = this.blockNormalAtLocation(blockPos, hitPos)
        newBlockPos = normal.add(blockPos)
      }
      else {
        newBlockPos = this.gameState.position.clone().add(cameraDirection.clone().multiplyScalar(Math.sqrt(3)))
        newBlockPos = newBlockPos.floor()
      }
      for (var i = 0; i< this.clickBuffer.rightClick; i++) {
        if (!this.playerCollidesWithCube(newBlockPos, this.gameState.position)) {
          if (!this.isDisallowedBlockPos(newBlockPos)) {
            if (this.gameState.withinWorldBounds(newBlockPos)) {
              this.gameState.addBlock(newBlockPos, this.gameState.selectedBlockColor)
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

  flyMoveTick(cameraDirection, timeDelta) {
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

    const acceleration = this.flyConfig.maxVelocity * (timeDelta/this.flyConfig.timeToReachMaxSpeed)
    const deceleration = this.flyConfig.maxVelocity * (timeDelta/this.flyConfig.timeToReachZeroSpeed)
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
    candidateVelocity.clampLength(0, this.flyConfig.maxVelocity) // convenient
    var candidatePosition = this.gameState.position.clone().add(candidateVelocity)

    this.checkCollisionUpdateVel(candidatePosition, candidateVelocity)
    this.velocity = candidateVelocity
    var newPosition = this.gameState.position.clone().add(candidateVelocity)
    this.gameState.position.set(newPosition.x, newPosition.y, newPosition.z)
  }

  walkMoveTick(cameraDirection, timeDelta) {
    //TODO: not accurate unless 60fps, need more *timeDeltas
    var walkForce = new Vector3(0, 0, 0)
    var verticalForce = new Vector3(0, 0.05*-9.8*timeDelta, 0)

    var verticalVelocity = new Vector3(0, this.velocity.y + verticalForce.y, 0)
    var candidatePosition = this.gameState.position.clone().add(verticalVelocity)
    var groundForce = this.playerCollisions(candidatePosition)
    var collisionBelow = false
    if (candidatePosition.y < 2.3 || groundForce.y == 1) {
      collisionBelow = true
      const playerCameraHeight = 1.3
      // go rest of way, otherwise will fall then stop then fall
      this.gameState.position.y = Math.ceil(candidatePosition.y - playerCameraHeight) + playerCameraHeight + 0.001
    }

    if ("w" in this.keyState) {
      walkForce.add(cameraDirection)
    } if ("s" in this.keyState) {
      walkForce.add(cameraDirection.clone().negate())
    } if ("a" in this.keyState) {
      walkForce.add((new Vector3(0, 1, 0)).cross(cameraDirection))
    } if ("d" in this.keyState) {
      walkForce.add((new Vector3(0, 1, 0)).cross(cameraDirection).negate())
    } if (" " in this.keyState) {
      collisionBelow && verticalForce.set(0, 0.15 , 0)
      delete this.keyState[" "]
    }

    walkForce.y = cameraDirection.y // so that if looking at ground, move slower
    walkForce = walkForce.normalize().multiplyScalar(0.1)

    var candidateHorizVelocity
    var candidateVertVelocity = new Vector3(0, 0, 0)
    var deceleration
    if (collisionBelow) {
      candidateHorizVelocity = this.velocity.clone().add(walkForce)
      candidateHorizVelocity.y = 0
      if (verticalForce.y > 0) {
        candidateVertVelocity.y += verticalForce.y
      }
      deceleration = Math.min(0.7*timeDelta, this.velocity.length())
    } else {
      deceleration = Math.min(0.2*timeDelta, this.velocity.length())
      candidateHorizVelocity = this.velocity.clone().add(walkForce.clone().multiplyScalar(0.1))
      candidateHorizVelocity.y = 0

      candidateVertVelocity.y = this.velocity.y
      candidateVertVelocity.y += verticalForce.y
    }

    candidateHorizVelocity.y = (Math.abs(cameraDirection.y) / 4)**1.5 // slower when looking down or up
    candidateHorizVelocity = candidateHorizVelocity.clampLength(0, 0.12)
    candidateVertVelocity = candidateVertVelocity.clampLength(0, 0.8)
    candidateHorizVelocity.y = 0
    var decelerationForce = candidateHorizVelocity.clone().normalize().negate().multiplyScalar(deceleration)
    candidateHorizVelocity.add(decelerationForce)

    var candidateVelocity = candidateHorizVelocity.clone().add(candidateVertVelocity)
    var candidatePosition = this.gameState.position.clone().add(candidateHorizVelocity)
    this.checkCollisionUpdateVel(candidatePosition, candidateVelocity)
    this.velocity = candidateVelocity
    var newPosition = this.gameState.position.clone().add(candidateVelocity)
    this.gameState.position.set(newPosition.x, newPosition.y, newPosition.z)

  }

  cameraRotationTick(cameraDirection, timeDelta) {
    // Camera rotation
    // Can move head more than 90 deg if move camera quickly
    var cameraCrossVec = (new Vector3(0, 1, 0)).cross(cameraDirection).normalize()
    var angleToStraightUp = cameraDirection.angleTo(new Vector3(0, 1, 0)) // straight up and down
    const minAngle = 0.01
    // in both cases, negative is up
    var tiltAmount = this.rotationSensitivty * this.mouseMoveBuffer.y
    var tiltDir = Math.sign(this.mouseMoveBuffer.y)
    var validTilt = tiltDir == -1 ?
      (angleToStraightUp + tiltAmount > minAngle) :
      (angleToStraightUp + tiltAmount < Math.PI - minAngle)

    if (validTilt) {
      this.gameState.camera.rotateOnWorldAxis(cameraCrossVec, tiltAmount)
    }

    this.gameState.camera.rotateOnWorldAxis(new Vector3(0, 1, 0), -this.rotationSensitivty * this.mouseMoveBuffer.x)

    this.gameState.camera.updateWorldMatrix()
  }

  externalTick() {
    var timestamp = window.performance.now()
    var timeDelta = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : (1/60)
    timeDelta = Math.min(timeDelta, 1/5)
    this.lastTimestamp = timestamp

    this.onNextTick && this.onNextTick()
    this.onNextTick = null

    var cameraDirection = new Vector3()
    this.gameState.camera.getWorldDirection(cameraDirection)

    // moving, looking, colliding
    if (!this.flying) {
      this.walkMoveTick(cameraDirection, timeDelta)
    } else {
      this.flyMoveTick(cameraDirection, timeDelta)
    }
    this.cameraRotationTick(cameraDirection, timeDelta)
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
    var initialOffset = 3 * Math.PI / 2.0 // s.t. circle starts at x=0, z=-1
    var rotationTime = 2 * (Math.PI/this.period) * time + initialOffset
    var newPos = (new Vector3(Math.cos(rotationTime)*this.radius, this.height, Math.sin(rotationTime)*this.radius)).add(new Vector3(this.center.x, 0, this.center.z))
    this.camera.position.set(newPos.x, newPos.y, newPos.z)
    this.camera.lookAt(this.lookAtPos)
    this.camera.updateWorldMatrix()
  }
}

// Utility functions

// simplifies flow of things
var runWithErrMsgAsync = async (promise, err) => {
  try {
    var res = await promise
    return res
  } catch(e) {
    console.log(e)
    throw err
  }
}

var ethStringToWei = amountString => {
  const ETH_DECIMALS = 18
  var tokenMultiplier = BigNumber(10).pow(BigNumber(ETH_DECIMALS))
  var convertedAmount = tokenMultiplier.multipliedBy(BigNumber(amountString))
  return convertedAmount
}

var weiStringToEthString = amountString => {
  const ETH_DECIMALS = 18
  var tokenMultiplier = BigNumber(10).pow(BigNumber(ETH_DECIMALS))
  var convertedAmount = BigNumber(amountString).dividedBy(tokenMultiplier)
  return convertedAmount.toFixed()
}

// note: web3 sha3 is actually keccak256. sha-3 standard is different from keccak256
function keccakUint8Array(array) {
  const hash = new Keccak(256)
  hash.update(Buffer.from(array))
  var hashHex = "0x" + hash.digest("hex")
  return hashHex
}

function keccakUtf8(string) {
  const hash = new Keccak(256)
  hash.update(string, "utf8")
  var hashHex = "0x" + hash.digest("hex")
  return hashHex
}

function hexToRGB(h) {
  return [+("0x"+h[1]+h[2]), +("0x"+h[3]+h[4]), +("0x"+h[5]+h[6])]
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
