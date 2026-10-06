import { Customer } from "../../domain/Customer.ts";
import { CustomerRepository } from "../../domain/CustomerRepository.ts";

export class SearchCustomerUseCase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(term: string, limit: number = 20): Promise<Customer[]> {
    const cleanTerm = (term ?? "").trim();
    if (!cleanTerm) {
      return await this.customerRepository.search("", limit);
    }
    return await this.customerRepository.search(cleanTerm, limit);
  }
}
