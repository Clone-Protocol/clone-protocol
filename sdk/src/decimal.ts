const SIGN_MASK = BigInt(0x8000_0000);
const SCALE_MASK = BigInt(0x00ff_0000);
const SCALE_SHIFT = BigInt(16);

export class Decimal {
  /**
   * Stripped down version of the rust-decimal library.
   */
  flags: bigint;
  lo: bigint;
  mid: bigint;
  hi: bigint;

  public constructor(data: Array<number>) {
    let bytes = data.map(BigInt);
    this.flags =
      (bytes[0] |
        (bytes[1] << BigInt(8)) |
        (bytes[2] << BigInt(16)) |
        (bytes[3] << BigInt(24))) &
      BigInt(0x801f_0000);
    this.lo =
      bytes[4] |
      (bytes[5] << BigInt(8)) |
      (bytes[6] << BigInt(16)) |
      (bytes[7] << BigInt(24));
    this.mid =
      bytes[8] |
      (bytes[9] << BigInt(8)) |
      (bytes[10] << BigInt(16)) |
      (bytes[11] << BigInt(24));
    this.hi =
      bytes[12] |
      (bytes[13] << BigInt(8)) |
      (bytes[14] << BigInt(16)) |
      (bytes[15] << BigInt(24));
  }

  public isNegative(): boolean {
    return (this.flags & SIGN_MASK) > 0;
  }

  public mantissa(): bigint {
    let base =
      BigInt(this.lo) |
      (BigInt(this.mid) << BigInt(32)) |
      (BigInt(this.hi) << BigInt(64));
    return this.isNegative() ? -base : base;
  }

  public scale(): bigint {
    return (this.flags & SCALE_MASK) >> SCALE_SHIFT;
  }

  public toNumber(): number {
    return Number(this.mantissa()) * 10 ** -Number(this.scale());
  }
}

export interface RawDecimal {
  data: Array<number>;
}

export const toDecimal = (raw: RawDecimal): Decimal => {
  return new Decimal(raw.data);
};
export const toNumber = (raw: RawDecimal): number => {
  return toDecimal(raw).toNumber();
};
export const getMantissa = (raw: RawDecimal): number => {
  return Number(toDecimal(raw).mantissa());
};
