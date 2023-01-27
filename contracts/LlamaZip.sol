//SPDX-License-Identifier: None
pragma solidity =0.7.6;

import "./PairList.sol";
import "./router/SwapRouter.sol";
import "./router/libs/IERC20.sol";

contract LlamaZip is SwapRouter {
    address public immutable pairList;

    constructor(address _factory, address _WETH9, address _pairList) SwapRouter(_factory, _WETH9) {
        pairList = _pairList;
    }

/*
pairs	4
swapDirection 1
	
slippage bits	14
zeros	8
	
decimal zeros	5
significant bits	till end
    -> if empty -> use max balance
*/

    // Because of function uniswapV3SwapCallback() 2.3e-8% of calls will fail because they'll hit that selector
    fallback() external payable {
        if(msg.sender == pairList){
            // Sweep tokens or ETH that got stuck here
            (address token, uint amount, address receiver) = abi.decode(msg.data, (address, uint, address));
            if(token == address(0)){
                payable(receiver).transfer(address(this).balance);
            } else {
                IERC20(token).transfer(receiver, amount); // We don't care if it fails
            }
            return;
        }

        uint data;
        assembly {
            data := calldataload(0)
        }
        uint pair = data & (0xf << (256-4));
        uint token0IsTokenIn = data & (0x1 << (256-4-1));
        (address token0,address token1,uint24 fee) = PairList(pairList).pools(pair);
        address tokenIn = token0IsTokenIn == 0?token1:token0;

        uint slippageSignificantBits = (data & (0x3fff << (256-5-14))) >> (256-5-14);
        uint outZeros = (data & (0xff << (256-5-14-8))) >> (256-5-14-8);

        uint minTotalOut = slippageSignificantBits << outZeros;
        uint totalIn;

        if(tokenIn == WETH9 && msg.value > 0){
            totalIn = msg.value;
        } else {
            uint inputDataExists = data & (type(uint256).max >> 5+14+8);
            if(inputDataExists == 0){
                totalIn = IERC20(tokenIn).balanceOf(msg.sender);
            } else {
                uint inZeros = (data & (0x1f << (256-5-14-8-5))) >> (256-5-14-8-5);
                uint calldataLength;
                assembly {
                    calldataLength := calldatasize()
                }
                // (type(uint256).max >> 5+14+8+5) = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff, this is done to get around stack too deep
                uint significantInputBits = (data & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff) >> (256-(calldataLength*8));
                totalIn = significantInputBits * (10**inZeros);
            }
        }

        address tokenOut = token0IsTokenIn == 0?token0:token1;
        swap(tokenIn, tokenOut, fee, totalIn, minTotalOut);
    }
}