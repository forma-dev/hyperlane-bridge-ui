import {
  EvmNativeTokenAdapter,
  ITokenAdapter,
  MultiProtocolProvider,
  TransferRemoteParams
} from '@hyperlane-xyz/sdk';
import {
  addressToByteHexString,
  addressToBytes32
} from '@hyperlane-xyz/utils';
import { PopulatedTransaction } from 'ethers';
import { HypNativeMinter__factory } from '../../../contracts/HypNativeMinter__factory';

export class EvmHypNativeMinterAdapter
  extends EvmNativeTokenAdapter
  implements ITokenAdapter<PopulatedTransaction>
{
  public readonly contract: T;

  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: { token: Address },
    public readonly contractFactory: any = HypNativeMinter__factory,
  ) {
    super(chainName, multiProvider, addresses);
    this.contract = contractFactory.connect(
      addresses.token,
      this.getProvider(),
    );
  }

  override async populateTransferRemoteTx({
    weiAmountOrId,
    destination,
    recipient,
    interchainGas,
  }: TransferRemoteParams): Promise<PopulatedTransaction> {
    if (!interchainGas)
      interchainGas = await this.quoteTransferRemoteGas(destination);

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
