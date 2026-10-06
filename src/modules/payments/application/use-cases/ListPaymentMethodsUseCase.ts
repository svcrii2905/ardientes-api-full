import { PaymentMethod } from "../../domain/PaymentMethod.ts";
import { PaymentMethodRepository } from "../../domain/PaymentMethodRepository.ts";

export interface ListPaymentMethodsDTO {
  activeOnly?: boolean;
}

export class ListPaymentMethodsUseCase {
  constructor(private readonly paymentMethodRepository: PaymentMethodRepository) {}

  async execute(dto: ListPaymentMethodsDTO = {}): Promise<PaymentMethod[]> {
    const activeOnly = dto.activeOnly ?? true;
    return await this.paymentMethodRepository.findAll(activeOnly);
  }
}
