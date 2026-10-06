import bcrypt from "bcrypt";
import { PasswordService } from "../../domain/services/PasswordService.ts";

export class BcryptPasswordService implements PasswordService {
  private readonly saltRounds: number;

  constructor(saltRounds: number = 10) {
    this.saltRounds = saltRounds;
  }

  async hash(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (_err) {
      return false;
    }
  }
}
