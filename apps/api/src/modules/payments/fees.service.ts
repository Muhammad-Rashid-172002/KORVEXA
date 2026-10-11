import { eq, inArray, platformSettings, type DbClient, type Executor } from '@glasswork/db';
import { quoteFees, SETTING_KEYS, type FeeQuote, type FeeSettings } from '@glasswork/shared';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../../infra/tokens';

/** Reads admin-editable fee settings (never hard-coded, D-045) and produces transparent breakdowns. */
@Injectable()
export class FeesService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async settings(exec: Executor = this.db.db): Promise<FeeSettings> {
    const keys = [
      SETTING_KEYS.buyerServiceFeeBps,
      SETTING_KEYS.buyerServiceFeeMinAmount,
      SETTING_KEYS.sellerCommissionBps,
      SETTING_KEYS.sellerCommissionMinAmount,
    ];
    const rows = await exec.select().from(platformSettings).where(inArray(platformSettings.key, keys));
    const num = (k: string) => {
      const v = rows.find((r) => r.key === k)?.value;
      return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : 0;
    };
    return {
      buyerServiceBps: Math.min(num(SETTING_KEYS.buyerServiceFeeBps), 10_000),
      buyerServiceMin: num(SETTING_KEYS.buyerServiceFeeMinAmount),
      sellerCommissionBps: Math.min(num(SETTING_KEYS.sellerCommissionBps), 10_000),
      sellerCommissionMin: num(SETTING_KEYS.sellerCommissionMinAmount),
    };
  }

  async quote(amount: number, exec: Executor = this.db.db): Promise<FeeQuote> {
    return quoteFees(amount, await this.settings(exec));
  }

  async autoApproveDays(exec: Executor = this.db.db): Promise<number> {
    const [row] = await exec
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, SETTING_KEYS.autoApproveDays));
    const v = row?.value;
    return typeof v === 'number' && v >= 1 && v <= 30 ? Math.trunc(v) : 5;
  }
}
