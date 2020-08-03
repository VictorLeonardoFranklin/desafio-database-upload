import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const transactions = await this.find();
    const balance = transactions.reduce(
      (soma: Balance, transaction: Transaction) => {
        switch (transaction.type) {
          case 'income':
            soma.income += Number(transaction.value);
            break;
          case 'outcome':
            soma.outcome += Number(transaction.value);
            break;
          default:
            break;
        }
        soma.total = soma.income - soma.outcome;
        return soma;
      },
      {
        income: 0,
        outcome: 0,
        total: 0,
      },
    );

    return balance;
  }
}

export default TransactionsRepository;
