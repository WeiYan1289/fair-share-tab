export interface EqualSplitParticipant {
  memberId: string;
  createdAt: Date;
}

export interface SplitShare {
  memberId: string;
  shareAmount: number;
}

export interface BillForNetting {
  payerId: string;
  totalAmount: number;
  splits: SplitShare[];
}

export type NetBalances = Map<string, number>;

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}
