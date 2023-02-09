//SPDX-License-Identifier: None
pragma solidity =0.7.6;

import "./PairList.sol";
import "./router/SwapRouter.sol";
import "./router/libs/IERC20.sol";

contract LlamaZip is SwapRouter {
    address internal immutable pairList; // Set to internal to avoid collisions
    uint internal constant MAX_BPS = 10000;

    constructor(address _factory, address _WETH9, address _pairList) SwapRouter(_factory, _WETH9) {
        pairList = _pairList;
    }

/*
pairs	4
swapDirection 1
	
slippage bits	16
zeros	8
slippage 2
	
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

        uint totalIn;
        if(tokenIn == WETH9 && msg.value > 0){
            totalIn = msg.value;
        } else {
            uint inputDataExists = data & (type(uint256).max >> 5+17+8+2);
            if(inputDataExists == 0){
                totalIn = IERC20(tokenIn).balanceOf(msg.sender);
            } else {
                uint inZeros = (data & (0x1f << (256-5-17-8-2-5))) >> (256-5-17-8-2-5);
                uint calldataLength;
                assembly {
                    calldataLength := calldatasize()
                }
                // (type(uint256).max >> 5+17+8+2+5) = 0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffff, this is done to get around stack too deep
                uint significantInputBits = (data & 0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffff) >> (256-(calldataLength*8));
                totalIn = significantInputBits * (10**inZeros);
            }
        }

        uint expectedSignificantBits = (data & (0x1ffff << (256-5-17))) >> (256-5-17);
        uint outZeros = (data & (0xff << (256-5-17-8))) >> (256-5-17-8);
        uint expectedTotalOut = expectedSignificantBits << outZeros;

        uint slippageBps;
        {
            uint slippageId = data & (0x3 << (256-5-17-8-2));
            if(slippageId == 0){
                slippageBps = MAX_BPS - 50; //0.5
            } else if(slippageId == (0x1 << (256-5-17-8-2))){
                slippageBps = MAX_BPS - 10; //0.1
            }  else if(slippageId == (0x2 << (256-5-17-8-2))){
                slippageBps = MAX_BPS - 100; //1
            }  else if(slippageId == (0x3 << (256-5-17-8-2))){
                slippageBps = MAX_BPS - 500; //5
            }
        }

        uint minTotalOut = (expectedTotalOut * slippageBps)/MAX_BPS;

        address tokenOut = token0IsTokenIn == 0?token0:token1;
        swap(tokenIn, tokenOut, fee, totalIn, expectedTotalOut, minTotalOut);
    }
}