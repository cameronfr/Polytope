pragma solidity ^0.5.0;

import "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/release-v2.5.0/contracts/token/ERC721/IERC721.sol";
import "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/release-v2.5.0/contracts/math/SafeMath.sol";


contract Market {

  using SafeMath for uint256;

  //Metadata
  string private _name = "Polytope Market";

  // Token contract
  address private constant tokenContractAddress = 0xcEEF34aa024F024a872b4bA7216e9741Ac011efe;
  IERC721 private constant tokenContract = IERC721(tokenContractAddress);

  // State
  mapping (uint256 => address) private tokenIsForSale; // address is the owner who listed it
  mapping (uint256 => uint256) private tokenPrice;

  // Fee
  uint256 private feePower = 5; // 1.0/(2^5) = 0.03125 = ~3%
  address payable private feeRecipient = 0xf91B98fe5Cc2a590C5d3DA72324f8A52F241D96B;

  // Events
  event TokenListed(uint256 tokenId, uint256 price);


  constructor () public {
  }

  function list(uint256 tokenId, uint256 price) external {
    address tokenOwner = tokenContract.ownerOf(tokenId);
    require(msg.sender == tokenOwner, "Invalid access");

    tokenIsForSale[tokenId] = tokenOwner;
    tokenPrice[tokenId] = price;

    emit TokenListed(tokenId, price);
  }

  function delist(uint256 tokenId) external {
    address tokenOwner = tokenContract.ownerOf(tokenId);
    require(msg.sender == tokenOwner, "Invalid access");

    tokenIsForSale[tokenId] = address(0);
  }

  function buyFungible(uint256 tokenId) payable external {
    address tokenOwner = tokenContract.ownerOf(tokenId);
    uint256 price = tokenPrice[tokenId];

    require(tokenIsForSale[tokenId] != address(0), "Token not listed");
    require(tokenIsForSale[tokenId] == tokenOwner, "Token listing invalid");
    require(msg.value == price, "Insufficient funds sent");

    uint256 fee = msg.value >> feePower;
    uint256 payment = msg.value - fee;
    address payable tokenOwnerPayable = address(uint160(tokenOwner)); // not nice

    tokenIsForSale[tokenId] = address(0);
    tokenContract.transferFrom(tokenOwner, msg.sender, tokenId);
    feeRecipient.transfer(fee);
    tokenOwnerPayable.transfer(payment); // untrusted
  }

  // Public view functions

  function isListed(uint256 tokenId) view public returns (bool) {
    address tokenOwner = tokenContract.ownerOf(tokenId);
    bool listingExists = tokenIsForSale[tokenId] != address(0);
    bool listingValid = tokenIsForSale[tokenId] == tokenOwner;
    bool marketIsApproved = tokenContract.isApprovedForAll(tokenOwner, address(this));

    return (listingExists && listingValid && marketIsApproved);
  }

  function listingPrice(uint256 tokenId) view public returns (uint256) {
    require(isListed(tokenId) == true, "Token not listed");
    uint256 price = tokenPrice[tokenId];
    return price;
  }
}
