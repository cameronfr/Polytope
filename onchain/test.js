// To start local babel kernel, run jp-babel-notebook in folder with correct node_modules.
//TODO: top level await in kernel would make testing much easier. As would easily swapping js-vm, testnet, and mainnet backends.
// Swapping: need some object with standard runTx and runCall interface (same inputs and return types)

solidity = require("solc")
ethjsABI = require("ethereumjs-abi")
ethjsVM = require("ethereumjs-vm").default
ethjsAccount = require("ethereumjs-account").default
ethjsTx = require("ethereumjs-tx").Transaction
ethjsUtil = require("ethereumjs-util")
fetch = require("node-fetch")
syncRequest = require('sync-request')
Web3 = require('web3')
web3 = new Web3(null) //Don't use provider

importCache = {}

function makeSolidityConfig(contractList) {
  sources = new Object()
  contractList.map(item => {
    sources[item] = {content: fs.readFileSync(path.join(__dirname, item), "utf-8")}
  })

  return {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: 'petersburg',
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode'],
        },
      },
    },
  }
}

// import "(.*?)";
// syncRequest("GET", "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/release-v2.5.0/contracts/ownership/Ownable.sol").getBody().toString("utf8")

function importCallback(path) {
  if (path in importCache) {
    contents = importCache[path]
  } else if (path.match(/https:\/\//)) {
    contents = syncRequest("GET", path).getBody().toString("utf8")
    importCache[path] = contents
  } else {
    contents = fs.readFileSync(path.join(__dirname, item), "utf-8")
    importCache[path] = contents
  }
  return {contents}
}

function getNonce(accountAddress) {
  return vm.pStateManager.getAccount(accountAddress).then(acc => acc.nonce)
}

function printABI(abi) {
  abi.forEach(method => {
    console.log((method.name || "constructor") + ": " + method.type)
    inputs = method.inputs.map(input => `${input.type} ${input.name}`)
    if (!method.outputs) {
      outputs = []
    } else {
      outputs = method.outputs.map(output => `${output.type} ${output.name}`)
    }
    console.log(inputs.join(", ") + " -> " + outputs.join(", "))
  console.log("")
  })
}

async function runTxWithAccount(tx, accountPk) {
  var address = ethjsUtil.privateToAddress(accountPk)
  tx.nonce = await vm.pStateManager.getAccount(address).then(acc => acc.nonce)
  tx.sign(accountPk)
  var res = await vm.runTx({ tx })
  var error = res.execResult.exceptionError
  if (error) {
    console.log(res)
    console.log("returned", res.execResult.returnValue.toString())
    throw error
  }
  return res
}

async function runCallWithAccount(tx, accountPk) {
  var address = ethjsUtil.privateToAddress(accountPk)
  tx.origin = address
  tx.caller = address
  var res = await vm.runCall(tx)
  var error = res.execResult.exceptionError
  if (error) {
    console.log(res)
    console.log("returned", res.execResult.returnValue.toString())
    throw error
  }
  return res
}

async function deployERC1155TradingContract(contractObj, constructArgs, accountPk) {
  var constructABI = contractObj.abi.filter(method => method.type == "constructor")[0]
  var inputTypes = constructABI.inputs.map(input => input.type)
  var params = ethjsABI.rawEncode(inputTypes, constructArgs)
  var tx = new ethjsTx({
    value: 0,
    gasLimit: 8000000,
    gasPrice: 1,
    data: Buffer.concat([Buffer.from(contractObj.evm.bytecode.object, "hex"), params]),
  })
  res = await runTxWithAccount(tx, accountPk)
  return res.createdAddress
}

async function runContractMethod(contractObj, methodName, methodArgs, accountPk) {
  // contractObj = contract; methodName="owner"; methodArgs=[]
  var possibleMethodsABIs = contract.abi.filter(item => item.name == methodName)
  if (possibleMethodsABIs.length > 1) {
    throw "ambiguous method"
  }
  var methodABI = possibleMethodsABIs[0]
  var inputTypes = methodABI.inputs.map(input => input.type)
  var outputTypes = methodABI.outputs.map(out => out.type)
  var signature = ethjsABI.methodID(methodName, inputTypes) // same as ABI sig
  var parameters = ethjsABI.rawEncode(inputTypes, methodArgs)
  var data = Buffer.concat([signature, parameters])
  var tx = {
    to: contractObj.address,
    data,
  }
  if (methodABI.constant) {
    res = await runCallWithAccount(tx, accountPk)
  } else {
    tx.value = 0
    tx.gasLimit = 800000
    tx.gasPrice = 1
    res = await runTxWithAccount(new ethjsTx(tx), accountPk)
  }
  var outputs = ethjsABI.rawDecode(outputTypes, res.execResult.returnValue)
  var outputField = outputs.length <= 1 ? outputs[0] : outputs
  var txField = res
  return [outputField, txField]
}

var contractList = ["myERC721.sol"]
var solidityConfig = makeSolidityConfig(contractList)
fs.writeFileSync("solidityJSON.json", JSON.stringify(solidityConfig))

// BELOW DOESN't work completely (becaise imports might import relatively), still need to manually inline after doing this
contractText = fs.readFileSync(path.join(__dirname, "myERC721.sol"), "utf-8")
contractLines = contractText.split("\n")
var contractLinesOut = []
contractLines.forEach(line => {
  var match = line.match("import \"(.*)\"")
  if (match != null) {
    importContent = importCallback(match[1])
    importLines = importContent.contents.split("\n")
    contractLinesOut = contractLinesOut.concat(importLines)
  } else {
    contractLinesOut.push(line)
  }
})
contractOut = contractLinesOut.join("\n")
fs.writeFileSync("contractInlined.sol", contractOut)


var compiled = JSON.parse(solidity.compile(JSON.stringify(solidityConfig), {import: importCallback}))
compiled.errors && compiled.errors.map(item => console.log(item.formattedMessage))

// properties: address, evm.bytecode.object, abi
var contract = compiled.contracts[contractList[0]].ERC1155Tradable

var vm = new ethjsVM()
var accountPk = new Buffer('e331b6d69882b4cb4ea581d88e0b604039a3de5967688d3dcffdd2270c0fd109', 'hex')
var accountAddress = ethjsUtil.privateToAddress(accountPk)
var accountObj = new ethjsAccount({ balance: 1e18 })
// We have to simulate a node where the stored state is an account with a given balance and nonce etc.
vm.pStateManager.putAccount(accountAddress, accountObj)
vm.pStateManager.getAccount(accountAddress).then(x => x.nonce)

deployPromise = deployERC1155TradingContract(contract, ["helloContract", "testing123#"], accountPk)
deployPromise.then(address => {contract.address = address})

contractNative = {}
contract.abi.forEach(method => contractNative[method.name] = async (...methodArgs) => {
  var res = await runContractMethod(contract, method.name, methodArgs, accountPk)
  transactionCostUSD = gasUsed => 10 * (10**(-9)) * 128 * gasUsed
  return [res[0], res[1].gasUsed.toString(), transactionCostUSD(res[1].gasUsed).toString()]
})

printABI(contract.abi)
contractNative.owner()
contractNative.name()


// Test making a single token
var tokenId = new ethjsUtil.BN(crypto.randomBytes(32))
var supply = new ethjsUtil.BN(crypto.randomBytes(8)) //Will be around 1*10**18
contractNative.create(accountAddress.toString("hex"), tokenId, supply, Buffer([])).then(res => {
  console.log(`Cost to create NFT is ${res[1]} gas ~${res[2]}$ USD`)
})
contractNative.balanceOf(accountAddress.toString("hex"), tokenId).then(res => {
  assert(res[0].eq(supply))
})
var baseURL = "https://polytope.io/"
contractNative.setBaseMetadataURI(baseURL)
contractNative.uri(tokenId).then(res => {
  assert(res[0] == (baseURL + tokenId.toString("hex", 64) + ".json"))
})

// Test

ethjsABI.rawEncode(["bytes"], ["0"])
