// import DLMM from '@meteora-ag/dlmm';
// import { rpc } from '@npc/solana';
// import { PublicKey } from '@solana/web3.js';
// import BN from 'bn.js';
// import { OpenPositionArgs } from './open-position.interfaces';

// /**
//  * Opens a new position in a Meteora liquidity pool.
//  *
//  * @param args The {@link OpenPositionArgs} for opening a new position.
//  */
// export async function openPosition(args: OpenPositionArgs): Promise< {
//   const USDC_USDT_POOL = new PublicKey('ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq'); // You can get your desired pool address from the API https://dlmm-api.meteora.ag/pair/all
//   const dlmmPool = await DLMM.create(rpc(), );
//   dlmmPool.program.methods.initializePosition()


//   const TOTAL_RANGE_INTERVAL = 10; // 10 bins on each side of the active bin
//   const minBinId = activeBin.bin_id - TOTAL_RANGE_INTERVAL;
//   const maxBinId = activeBin.bin_id + TOTAL_RANGE_INTERVAL;

//   const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
//     Number(activeBin.price)
//   );
//   const totalXAmount = new BN(100);
//   const totalYAmount = totalXAmount.mul(new BN(Number(activeBinPricePerToken)));

//   dlmmPool.initializePositionByOperator()
//   // Create Position (Spot Balance deposit, Please refer ``example.ts` for more example)
//   const createPositionTx =
//     await dlmmPool.initializePositionAndAddLiquidityByStrategy({
//       positionPubKey: newBalancePosition.publicKey,
//       user: user.publicKey,
//       totalXAmount,
//       totalYAmount,
//       strategy: {
//         maxBinId,
//         minBinId,
//         strategyType: StrategyType.SpotBalanced,
//       },
//     });

//   try {
//     const createBalancePositionTxHash = await sendAndConfirmTransaction(
//       connection,
//       createPositionTx,
//       [user, newBalancePosition]
//     );
//   } catch (error) {}
// }

// export type * from './open-position.interfaces';
