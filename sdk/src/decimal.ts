import { assert } from "chai";

const SIGN_MASK = BigInt(0x8000_0000);
const SCALE_MASK = BigInt(0x00ff_0000);
const SCALE_SHIFT = BigInt(16);
const MAX_PRECISION_U32 = BigInt(28);
const U32_MASK = BigInt(4_294_967_295);
const U8_MASK = BigInt(0x0000_00ff);

export class Decimal {
  /**
   * Stripped down version of the rust-decimal library.
   */
  flags: bigint;
  lo: bigint;
  mid: bigint;
  hi: bigint;

  public constructor(num?: bigint, scale?: bigint) {
    if (num == undefined || scale == undefined) {
      this.flags = BigInt(0);
      this.lo = BigInt(0);
      this.mid = BigInt(0);
      this.hi = BigInt(0);
      return;
    }
    assert(scale <= MAX_PRECISION_U32, "scale exceeds maximum precision!");

    let flags = scale << SCALE_SHIFT;
    if (num < BigInt(0)) {
      const pos_num = num; // stuff with wrapping_neg
      this.flags = flags | SIGN_MASK;
      this.hi = BigInt(0);
      this.lo = pos_num & U32_MASK;
      this.mid = (pos_num >> BigInt(32)) & U32_MASK;
      return;
    }
    this.flags = flags;
    this.hi = BigInt(0);
    this.lo = num & U32_MASK;
    this.mid = (num >> BigInt(32)) & U32_MASK;
  }

  public serialize() {
    let array = [
      this.flags & U8_MASK,
      (this.flags >> BigInt(8)) & U8_MASK,
      (this.flags >> BigInt(16)) & U8_MASK,
      (this.flags >> BigInt(24)) & U8_MASK,
      this.lo & U8_MASK,
      (this.lo >> BigInt(8)) & U8_MASK,
      (this.lo >> BigInt(16)) & U8_MASK,
      (this.lo >> BigInt(24)) & U8_MASK,
      this.mid & U8_MASK,
      (this.mid >> BigInt(8)) & U8_MASK,
      (this.mid >> BigInt(16)) & U8_MASK,
      (this.mid >> BigInt(24)) & U8_MASK,
      this.hi & U8_MASK,
      (this.hi >> BigInt(8)) & U8_MASK,
      (this.hi >> BigInt(16)) & U8_MASK,
      (this.hi >> BigInt(24)) & U8_MASK,
    ];
    return array.map(Number);
  }

  public deserialize(data: Array<number>) {
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

  public toRawDecimal(): RawDecimal {
    return { data: this.serialize() } as RawDecimal;
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
  let result = new Decimal();
  result.deserialize(raw.data);
  return result;
};

export const toNumber = (raw: RawDecimal): number => {
  return toDecimal(raw).toNumber();
};

export const getMantissa = (raw: RawDecimal): number => {
  return Number(toDecimal(raw).mantissa());
};
