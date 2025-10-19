export interface TransferFormValues {
  origin: ChainName;
  destination: ChainName;
  tokenIndex: number | undefined;
  amount: string;
  recipient: Address;
  // Relay token selection
  selectedToken?: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    chainId: number;
    currency?: string; // Optional for compatibility with Relay token objects
    contractAddress?: string; // Optional for compatibility with Relay token objects
  };
}

export enum TransferStatus {
  Preparing = 'preparing',
  CreatingTxs = 'creating-txs',
  SigningApprove = 'signing-approve',
  ConfirmingApprove = 'confirming-approve',
  SigningTransfer = 'signing-transfer',
  ConfirmingTransfer = 'confirming-transfer',
  ConfirmedTransfer = 'confirmed-transfer',
  Delivered = 'delivered',
  Failed = 'failed',
}

export const SentTransferStatuses = [TransferStatus.ConfirmedTransfer, TransferStatus.Delivered];

// Statuses considered not pending
export const FinalTransferStatuses = [...SentTransferStatuses, TransferStatus.Failed];

export interface TransferContext {
  status: TransferStatus;
  origin: ChainName;
  destination: ChainName;
  originTokenAddressOrDenom?: string;
  destTokenAddressOrDenom?: string;
  // Store the full selected token object to preserve icon and metadata
  selectedToken?: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    chainId: number;
    currency?: string;
    contractAddress?: string;
  };
  amount: string;
  sender: Address;
  recipient: Address;
  originTxHash?: string;
  msgId?: string;
  relayTxHash?: string; // Transaction hash from Relay SDK for status tracking
  timestamp: number;
  fees?: {
    gas?: {
      amountFormatted: string;
      currency?: {
        symbol: string;
      };
    };
    relayer?: {
      amountFormatted: string;
      currency?: {
        symbol: string;
      };
    };
  };
}
