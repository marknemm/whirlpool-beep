import BN from 'bn.js';
import Decimal from 'decimal.js';

export interface OpenPositionArgs {

  liquidity: BN | Decimal.Value;

}
