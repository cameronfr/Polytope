pragma solidity ^0.5.12;

import "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/release-v2.5.0/contracts/ownership/Ownable.sol";
import 'https://raw.githubusercontent.com/arcadeum/multi-token-standard/b9a23c5756cb8593c0abadc168e5bd3684a8ccbc/contracts/tokens/ERC1155/ERC1155.sol';
import 'https://raw.githubusercontent.com/arcadeum/multi-token-standard/b9a23c5756cb8593c0abadc168e5bd3684a8ccbc/contracts/tokens/ERC1155/ERC1155Metadata.sol';
import 'https://raw.githubusercontent.com/arcadeum/multi-token-standard/b9a23c5756cb8593c0abadc168e5bd3684a8ccbc/contracts/tokens/ERC1155/ERC1155MintBurn.sol';

/**
 * @title ERC1155Tradable
 * ERC1155Tradable - ERC1155 contract that has create and mint functionality
 */
contract ERC1155Tradable is ERC1155, ERC1155MintBurn, ERC1155Metadata, Ownable {

  // Creator of a given token
  mapping (uint256 => address) public creator;
  // Total quantity of a given token in existence
  mapping (uint256 => uint256) public tokenSupply;
  // Contract name
  string public name;
  // Contract symbol
  string public symbol;

  constructor(string memory _name, string memory _symbol) public {
    name = _name;
    symbol = _symbol;
  }

  // Minting to the zero address disallowed to prevent mistakes
  function create(address _initialOwner, uint256 _id, uint256 _initialSupply, bytes calldata _data) external {
    require(_initialOwner != address(0), "ERC1155Tradable#create: mint to the zero address");
    require(!_exists(_id), "ERC1155Tradable#create: token already minted");

    creator[_id] = msg.sender;
    emit URI(uri(_id), _id);
    _mint(_initialOwner, _id, _initialSupply, _data);
    tokenSupply[_id] = _initialSupply;
  }

  function batchCreate(address _initialOwner, uint256[] calldata _ids, uint256[] calldata _quantities, bytes calldata _data) external {
    require(_initialOwner != address(0), "ERC1155Tradable#create: mint to the zero address");

    for (uint256 i = 0; i < _ids.length; i++) {
      uint256 _id = _ids[i];
      require(!_exists(_id), "ERC1155Tradable#batchCreate: token already minted");
      uint256 quantity = _quantities[i];
      emit URI(uri(_id), _id);
      tokenSupply[_id] = quantity;
    }
    _batchMint(_initialOwner, _ids, _quantities, _data);
  }

  function _exists(uint256 _id) internal view returns (bool) {
    return creator[_id] != address(0);
  }

  function setBaseMetadataURI(string memory _newBaseMetadataURI) public onlyOwner {
    _setBaseMetadataURI(_newBaseMetadataURI);
  }

  function uri(uint256 _id) public view returns (string memory) {
    return string(abi.encodePacked(baseMetadataURI, _uint2hex(_id), ".json"));
  }

  function _uint2hex(uint256 _val) internal pure returns (string memory _uintAsString) {
    uint256 len = 64;
    uint256 remaining = _val;
    bytes memory bstr = new bytes(len);
    uint256 k = len - 1;

    // get ascii
    for (uint256 i = 0; i < len; i++) {
      uint256 mod = remaining % 16;
      bstr[k--] = byte(uint8(mod < 10 ? (mod + 48) : (mod - 10 + 97)));
      remaining /= 16;
    }

    // Convert to string
    return string(bstr);
  }
}
