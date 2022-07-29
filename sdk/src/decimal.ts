const SIGN_MASK = 0x8000_0000;
const SCALE_MASK = 0x00ff_0000;
const SCALE_SHIFT = 16;

export class Decimal {
  /**
   * Stripped down version of the rust-decimal library.
   */
  flags: number;
  lo: number;
  mid: number;
  hi: number;

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

  public scale(): number {
    return (this.flags & SCALE_MASK) >> SCALE_SHIFT;
  }

  public toNumber(): number {
    return Number(this.mantissa()) * 10 ** -this.scale();
  }
}

export class RawDecimal {
  /**
   * Class for holding the raw bytes data of the Decimal type.
   * Added methods to easily convert to Decimal or number.
   */
  data: Array<number>;

  constructor(data: Array<number>) {
    this.data = data;
  }

  public toDecimal(): Decimal {
    const bytes = this.data;
    let result = new Decimal();

    result.flags =
      (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) &
      0x801f_0000;
    result.lo =
      bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    result.mid =
      bytes[8] | (bytes[9] << 8) | (bytes[10] << 16) | (bytes[11] << 24);
    result.hi =
      bytes[12] | (bytes[13] << 8) | (bytes[14] << 16) | (bytes[15] << 24);
    return result;
  }

  public toNumber(): number {
    return this.toDecimal().toNumber();
  }
}
