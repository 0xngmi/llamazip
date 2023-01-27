// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import "./libs/CallbackValidation.sol";
import "./libs/PeripheryPayments.sol";
import "./libs/PeripheryImmutableState.sol";
import "./libs/SafeCast.sol";

interface IUniswapV3Pool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

contract SwapRouter is PeripheryImmutableState, PeripheryPayments {
    using SafeCast for uint256;

    /// @dev The minimum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MIN_TICK)
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MAX_TICK)
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    constructor(address _factory, address _WETH9) PeripheryImmutableState(_factory, _WETH9) {}

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(tokenA, tokenB, fee)));
    }

    struct SwapCallbackData {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address payer;
    }

    function swap(address tokenIn, address tokenOut, uint24 fee, uint amountIn, uint minAmountOut) internal {
        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) =
            getPool(tokenIn, tokenOut, fee).swap(
                tokenOut == WETH9? address(this):msg.sender,
                zeroForOne,
                amountIn.toInt256(),
                (zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1),
                abi.encode(SwapCallbackData({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: fee,
                    payer: msg.sender
                }))
            );

        uint amountOut = uint256(-(zeroForOne ? amount1 : amount0));

        require(amountOut >= minAmountOut, 'Too little received');

        if(tokenOut == WETH9){
            // Doesn't support WETH output since we can't differentiate
            uint256 balanceWETH9 = IWETH9(WETH9).balanceOf(address(this));
            IWETH9(WETH9).withdraw(balanceWETH9);
            TransferHelper.safeTransferETH(msg.sender, balanceWETH9);
        }
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata _data
    ) external {
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        CallbackValidation.verifyCallback(factory, data.tokenIn, data.tokenOut, data.fee);

        pay(data.tokenIn, data.payer, msg.sender, amount0Delta > 0? uint256(amount0Delta) : uint256(amount1Delta));
    }
}