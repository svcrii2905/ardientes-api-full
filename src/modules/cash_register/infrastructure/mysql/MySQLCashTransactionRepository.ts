import { CashTransaction } from "../../domain/CashTransaction.ts";
import { CashTransactionRepository, CashSessionTotals } from "../../domain/CashTransactionRepository.ts";
import { CashTransactionType } from "../../domain/value-objects/CashTransactionType.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLCashTransactionRepository implements CashTransactionRepository {
  async save(transaction: CashTransaction, dbExecutor?: QueryExecutor): Promise<CashTransaction> {
    const exec = dbExecutor || client;
    const createdAtFormatted = transaction.createdAt
      ? transaction.createdAt.toISOString().slice(0, 19).replace("T", " ")
      : new Date().toISOString().slice(0, 19).replace("T", " ");

    const result = await exec.execute(
      `INSERT INTO cash_transactions (
        session_id, transaction_type, order_payment_id, amount, performed_by, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction.sessionId,
        transaction.transactionType.value,
        transaction.orderPaymentId,
        transaction.amount,
        transaction.performedBy,
        transaction.notes,
        createdAtFormatted,
      ]
    );

    const insertedId = result.lastInsertId!;

    return new CashTransaction(
      insertedId,
      transaction.sessionId,
      transaction.transactionType,
      transaction.orderPaymentId,
      transaction.amount,
      transaction.performedBy,
      transaction.notes,
      transaction.createdAt ?? new Date()
    );
  }

  async findBySessionId(sessionId: number, dbExecutor?: QueryExecutor): Promise<CashTransaction[]> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      "SELECT id, session_id, transaction_type, order_payment_id, amount, performed_by, notes, created_at FROM cash_transactions WHERE session_id = ? ORDER BY created_at ASC",
      [sessionId]
    );
    return rows.map((row: any) => this.mapToDomain(row));
  }

  async calculateSessionTotals(sessionId: number, openingBalance: number, dbExecutor?: QueryExecutor): Promise<CashSessionTotals> {
    const exec = dbExecutor || client;
    // 1. totalDeposits: sum of DEPOSIT
    const depositsRow = await exec.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE session_id = ? AND transaction_type = 'DEPOSIT'",
      [sessionId]
    );
    const totalDeposits = Number(depositsRow[0]?.total ?? 0);

    // 2. totalWithdrawals: sum of WITHDRAWAL (includes manual and payment reversions)
    const withdrawalsRow = await exec.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE session_id = ? AND transaction_type = 'WITHDRAWAL'",
      [sessionId]
    );
    const totalWithdrawals = Number(withdrawalsRow[0]?.total ?? 0);

    // 3. totalOrderPaymentsCash: Sum of COMPLETADO cash payments
    const paymentsCashRow = await exec.query(
      `SELECT COALESCE(SUM(op.amount), 0) as total 
       FROM order_payments op
       JOIN payment_methods pm ON op.payment_method_id = pm.id
       WHERE op.session_id = ? AND pm.type = 'CASH' AND op.status = 'COMPLETADO'`,
      [sessionId]
    );
    const totalOrderPaymentsCash = Number(paymentsCashRow[0]?.total ?? 0);

    // 4. totalOrderPaymentsDigital: Sum of COMPLETADO digital payments
    const paymentsDigitalRow = await exec.query(
      `SELECT COALESCE(SUM(op.amount), 0) as total 
       FROM order_payments op
       JOIN payment_methods pm ON op.payment_method_id = pm.id
       WHERE op.session_id = ? AND pm.type = 'DIGITAL' AND op.status = 'COMPLETADO'`,
      [sessionId]
    );
    const totalOrderPaymentsDigital = Number(paymentsDigitalRow[0]?.total ?? 0);

    // 5. totalOrderPaymentsCard: Sum of COMPLETADO card payments
    const paymentsCardRow = await exec.query(
      `SELECT COALESCE(SUM(op.amount), 0) as total 
       FROM order_payments op
       JOIN payment_methods pm ON op.payment_method_id = pm.id
       WHERE op.session_id = ? AND pm.type = 'CARD' AND op.status = 'COMPLETADO'`,
      [sessionId]
    );
    const totalOrderPaymentsCard = Number(paymentsCardRow[0]?.total ?? 0);

    // 6. totalManualWithdrawals: Sum of WITHDRAWAL that does not reference any payment (manual cash-outs)
    const manualWithdrawalsRow = await exec.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions 
       WHERE session_id = ? AND transaction_type = 'WITHDRAWAL' AND order_payment_id IS NULL`,
      [sessionId]
    );
    const totalManualWithdrawals = Number(manualWithdrawalsRow[0]?.total ?? 0);

    // expected cash in register:
    // openingBalance + totalDeposits - totalManualWithdrawals + totalOrderPaymentsCash
    const totalExpectedCash = openingBalance + totalDeposits - totalManualWithdrawals + totalOrderPaymentsCash;

    return {
      totalDeposits,
      totalWithdrawals,
      totalOrderPaymentsCash,
      totalOrderPaymentsDigital,
      totalOrderPaymentsCard,
      totalExpectedCash: Math.round(totalExpectedCash * 100) / 100,
    };
  }

  private mapToDomain(row: any): CashTransaction {
    return new CashTransaction(
      row.id,
      row.session_id,
      CashTransactionType.create(row.transaction_type),
      row.order_payment_id ?? null,
      Number(row.amount),
      row.performed_by,
      row.notes ?? null,
      row.created_at ? new Date(row.created_at) : null
    );
  }
}
