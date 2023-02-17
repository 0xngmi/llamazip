//SPDX-License-Identifier: None
pragma solidity =0.7.6;
pragma abicoder v2;

import "./router/SwapRouter.sol";
import "./router/libs/IERC20.sol";

interface UniswapV3Pool {
    function token0() external returns (address);
    function token1() external returns (address);
    function fee() external returns (uint24);
}

contract LlamaZip is SwapRouter {
    address internal immutable owner; // Set to internal to avoid collisions
    uint internal constant MAX_BPS = 10000;

    constructor(address _factory, address _WETH9, address _owner) SwapRouter(_factory, _WETH9) {
        owner = _owner;
    }

    struct Pool {
        address token0;
        address token1;
        uint24 fee;
    }

    mapping(uint => Pool) internal pools;

    function setPool(uint id, address pool) internal {
        require(pools[id].token0 == address(0) && pools[id].token1 == address(0), "already set");

        pools[id] = Pool({
            fee: UniswapV3Pool(pool).fee(),
            token0: UniswapV3Pool(pool).token0(),
            token1: UniswapV3Pool(pool).token1()
        });
    }

    function getPool(uint poolId) view internal returns (Pool memory pool){
        if(poolId == 0){
            return Pool(0x4200000000000000000000000000000000000006, 0x7F5c764cBc14f9669B88837ca1490cCa17c31607, 500); // WETH / USDC 0.05%
        } else if(poolId == (1 << 252)){
            return Pool(0x4200000000000000000000000000000000000006, 0x4200000000000000000000000000000000000042, 3000); // WETH / OP 0.3%
        } else if(poolId == (2 << 252)){
            return Pool(0x4200000000000000000000000000000000000042, 0x7F5c764cBc14f9669B88837ca1490cCa17c31607, 3000); // OP / USDC 0.3%
        } else if(poolId == (3 << 252)){
            return Pool(0x4200000000000000000000000000000000000006, 0x4200000000000000000000000000000000000042, 500); // WETH / OP 0.05%
        } else if(poolId == (4 << 252)){
            return Pool(0x7F5c764cBc14f9669B88837ca1490cCa17c31607, 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1, 100); // USDC / DAI 0.01%
        } else if(poolId == (5 << 252)){
            return Pool(0x4200000000000000000000000000000000000006, 0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4, 3000); // WETH / SNX 0.3%
        } else if(poolId == (6 << 252)){
            return Pool(0x4200000000000000000000000000000000000006, 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1, 3000); // WETH / DAI 0.3%
        }

        return pools[poolId];
    }

    // Because of function uniswapV3SwapCallback() 2.3e-8% of calls will fail because they'll hit that selector
    fallback() external payable {
        if(msg.sender == owner){
            (uint method) = abi.decode(msg.data, (uint));
            if(method == 0){
                // Sweep tokens or ETH that got stuck here
                (,address token, uint amount, address receiver) = abi.decode(msg.data, (uint, address, uint, address));
                if(token == address(0)){
                    payable(receiver).transfer(address(this).balance);
                } else {
                    IERC20(token).transfer(receiver, amount); // We don't care if it fails
                }
            } else{
                (,uint poolId, address poolAddress) = abi.decode(msg.data, (uint, uint, address));
                setPool(poolId, poolAddress);
            }
            return;
        }

        uint data;
        assembly {
            data := calldataload(0)
        }
        uint pair = data & (0xf << (256-4));
        uint token0IsTokenIn = data & (0x1 << (256-4-1));
        Pool memory pool = getPool(pair);
        address tokenIn = token0IsTokenIn == 0?pool.token1:pool.token0;

        uint expectedSignificantBits = (data & (0x1ffff << (256-5-17))) >> (256-5-17);
        uint outZeros = (data & (0xff << (256-5-17-8))) >> (256-5-17-8);
        uint expectedTotalOut = expectedSignificantBits << outZeros;

        uint totalIn;
        if(tokenIn == WETH9 && msg.value > 0){
            totalIn = msg.value;
        } else {
            uint inputDataExists = data & (type(uint256).max >> 5+17+8+2);
            if(inputDataExists == 0){
                totalIn = IERC20(tokenIn).balanceOf(msg.sender);
                expectedTotalOut = (expectedTotalOut*totalIn)/1e18; // use it as a rate instead
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

        address tokenOut = token0IsTokenIn == 0?pool.token0:pool.token1;
        swap(tokenIn, tokenOut, pool.fee, totalIn, expectedTotalOut, minTotalOut);
    }
}