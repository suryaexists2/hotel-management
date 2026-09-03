import { Prisma, prisma } from '@innsight/database';
import type {
  UpdateHotelInput,
  UpdateHotelSettingsInput,
  UpsertTaxRuleInput,
} from '@innsight/shared';
import { NotFoundError } from '../../shared/errors/app-error.js';

const currencySymbolMap: Record<string, string> = {
  USD: '$', INR: 'Rs.', EUR: 'EUR', GBP: 'GBP', AED: 'AED',
  AUD: 'A$', CAD: 'C$', SGD: 'S$', MYR: 'RM', JPY: 'JPY',
  CNY: 'CNY', KRW: 'KRW', THB: 'THB', CHF: 'CHF', NZD: 'NZ$',
  HKD: 'HK$', BRL: 'R$', ZAR: 'R', RUB: 'RUB', MXN: 'Mex$',
  IDR: 'Rp', PHP: 'PHP', SEK: 'SEK', NOK: 'NOK', DKK: 'DKK',
  SAR: 'SAR', TRY: 'TRY', PLN: 'PLN', NGN: 'NGN',
};

function deriveSymbol(currency: string): string {
  return currencySymbolMap[currency] || `${currency} `;
}

const hotelInclude = { settings: true } satisfies Prisma.HotelInclude;
export type HotelDTO = Prisma.HotelGetPayload<{ include: typeof hotelInclude }>;
export type TaxRuleDTO = Prisma.TaxRuleGetPayload<Record<string, never>>;

/**
 * Tenant hotel profile, operational settings and tax rules. Every method is scoped
 * by `hotelId` taken from the session, so one tenant can never read or mutate another.
 */
export class HotelService {
  async getCurrent(hotelId: string): Promise<HotelDTO> {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, include: hotelInclude });
    if (!hotel) {
      throw new NotFoundError('Hotel not found');
    }
    return hotel;
  }

  async update(hotelId: string, input: UpdateHotelInput): Promise<HotelDTO> {
    await this.assertExists(hotelId);
    const data = { ...input } as Record<string, unknown>;
    if (input.currency && !input.currencySymbol) {
      data.currencySymbol = deriveSymbol(input.currency);
    }
    return prisma.hotel.update({ where: { id: hotelId }, data, include: hotelInclude });
  }

  async updateSettings(hotelId: string, input: UpdateHotelSettingsInput): Promise<HotelDTO> {
    await this.assertExists(hotelId);

    const data: Prisma.HotelSettingsUncheckedUpdateInput = {};
    if (input.supportedCurrencies !== undefined) data.supportedCurrencies = JSON.stringify(input.supportedCurrencies) as any;
    if (input.defaultTaxRate !== undefined) data.defaultTaxRate = new Prisma.Decimal(input.defaultTaxRate);
    if (input.allowOverbooking !== undefined) data.allowOverbooking = input.allowOverbooking;
    if (input.overbookingLimit !== undefined) data.overbookingLimit = input.overbookingLimit;

    await prisma.hotelSettings.upsert({
      where: { hotelId },
      update: data,
      create: {
        hotelId,
        supportedCurrencies: input.supportedCurrencies ? JSON.stringify(input.supportedCurrencies) : '["USD"]' as any,
        defaultTaxRate: new Prisma.Decimal(input.defaultTaxRate ?? 0),
        allowOverbooking: input.allowOverbooking ?? false,
        overbookingLimit: input.overbookingLimit ?? 0,
      },
    });

    return this.getCurrent(hotelId);
  }

  async listTaxRules(hotelId: string): Promise<TaxRuleDTO[]> {
    return prisma.taxRule.findMany({ where: { hotelId }, orderBy: { createdAt: 'desc' } });
  }

  async createTaxRule(hotelId: string, input: UpsertTaxRuleInput): Promise<TaxRuleDTO> {
    return prisma.taxRule.create({
      data: {
        hotelId,
        name: input.name,
        rate: new Prisma.Decimal(input.rate),
        appliesTo: JSON.stringify(input.appliesTo) as any,
        isInclusive: input.isInclusive,
        isActive: input.isActive,
      },
    });
  }

  async updateTaxRule(hotelId: string, id: string, input: UpsertTaxRuleInput): Promise<TaxRuleDTO> {
    await this.assertTaxRuleOwned(hotelId, id);
    return prisma.taxRule.update({
      where: { id },
      data: {
        name: input.name,
        rate: new Prisma.Decimal(input.rate),
        appliesTo: JSON.stringify(input.appliesTo) as any,
        isInclusive: input.isInclusive,
        isActive: input.isActive,
      },
    });
  }

  async deleteTaxRule(hotelId: string, id: string): Promise<void> {
    await this.assertTaxRuleOwned(hotelId, id);
    await prisma.taxRule.delete({ where: { id } });
  }

  private async assertExists(hotelId: string): Promise<void> {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true } });
    if (!hotel) {
      throw new NotFoundError('Hotel not found');
    }
  }

  private async assertTaxRuleOwned(hotelId: string, id: string): Promise<void> {
    const rule = await prisma.taxRule.findFirst({ where: { id, hotelId }, select: { id: true } });
    if (!rule) {
      throw new NotFoundError('Tax rule not found');
    }
  }
}

export const hotelService = new HotelService();
