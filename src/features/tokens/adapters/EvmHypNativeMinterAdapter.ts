import { BigNumber, PopulatedTransaction } from 'ethers';

import {
  EvmHypSyntheticAdapter,
  IHypTokenAdapter,
  MultiProtocolProvider,
  TransferParams,
  TransferRemoteParams,
} from '@hyperlane-xyz/sdk';
import { addressToByteHexString, addressToBytes32 } from '@hyperlane-xyz/utils';

import { HypNativeMinter__factory } from '../../../contracts/HypNativeMinter__factory';

export class EvmHypNativeMinterAdapter
  extends EvmHypSyntheticAdapter
  implements IHypTokenAdapter<PopulatedTransaction>
{
  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: { token: Address },
    public readonly contractFactory: any = HypNativeMinter__factory,
  ) {
    super(chainName, multiProvider, addresses, contractFactory);
  }

  async isApproveRequired(): Promise<boolean> {
    return false;
  }

  async getBalance(address: Address): Promise<bigint> {
    const balance = await this.getProvider().getBalance(address);
    return BigInt(balance.toString());
  }

  async populateTransferTx({
    weiAmountOrId,
    recipient,
  }: TransferParams): Promise<PopulatedTransaction> {
    const value = BigNumber.from(weiAmountOrId.toString());
    return { value, to: recipient };
  }

  async populateTransferRemoteTx({
    weiAmountOrId,
    destination,
    recipient,
    interchainGas,
  }: TransferRemoteParams): Promise<PopulatedTransaction> {
    if (!interchainGas) interchainGas = await this.quoteTransferRemoteGas(destination);

    if (BigInt(weiAmountOrId) < BigInt(1e12)) {
      weiAmountOrId = BigInt(1e12).toString();
    }

    let txValue: bigint | undefined = undefined;
    const { amount: igpAmount } = interchainGas;
    const bigintWeiAmountOrId = BigInt(weiAmountOrId);
    txValue = igpAmount + bigintWeiAmountOrId;

    const recipBytes32 = addressToBytes32(addressToByteHexString(recipient));
    return this.contract.populateTransaction.transferRemote(
      destination,
      recipBytes32,
      weiAmountOrId,
      { value: txValue?.toString() },
    );
  }
}
