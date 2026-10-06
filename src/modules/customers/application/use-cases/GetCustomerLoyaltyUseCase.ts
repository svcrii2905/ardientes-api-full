import { CustomerRepository } from "../../domain/CustomerRepository.ts";
import { NotFoundError } from "../../../../shared/domain/error.ts";
import { LoyaltyTransaction } from "../../domain/LoyaltyTransaction.ts";

export interface CustomerLoyaltyStatus {
  customerId: number;
  fullName: string;
  phone: string;
  points: number;
  availableRewards: number;
  pointsToNextReward: number;
  canRedeem: boolean;
  statusMessage: string;
  history: LoyaltyTransaction[];
}

export class GetCustomerLoyaltyUseCase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(customerId: number): Promise<CustomerLoyaltyStatus> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Cliente con ID ${customerId} no encontrado`);
    }

    const history = await this.customerRepository.getLoyaltyHistory(customerId, 15);
    const availableRewards = customer.getAvailableRewards();
    const pointsToNextReward = customer.getPointsToNextReward();

    let statusMessage = "";
    if (availableRewards > 0) {
      const rewardText = availableRewards === 1 ? "1 hamburguesa gratis" : `${availableRewards} hamburguesas gratis`;
      statusMessage = `🎉 PREMIO DISPONIBLE · 🍔 ${rewardText}`;
    } else {
      statusMessage = `🔥 ${customer.loyaltyPoints} / 10 puntos · Faltan ${pointsToNextReward} puntos para una hamburguesa gratis`;
    }

    return {
      customerId: customer.id!,
      fullName: customer.fullName,
      phone: customer.phone,
      points: customer.loyaltyPoints,
      availableRewards,
      pointsToNextReward,
      canRedeem: customer.canRedeemBurger(),
      statusMessage,
      history,
    };
  }
}
