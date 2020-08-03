import { getCustomRepository, getRepository, In } from 'typeorm';
import TransactionsRepository from '../repositories/TransactionsRepository';
import AppError from '../errors/AppError';
import path from 'path';
import fs from 'fs';
import uploadConfig from '../config/upload';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import csvParse from 'csv-parse';
import parse from 'csv-parse';
import { SupportOptionRange } from 'prettier';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const constactsReadStream = fs.createReadStream(filePath);
    const parses = csvParse({
      from_line: 2,
    });

    const parseCSV = constactsReadStream.pipe(parses);
    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) {
        throw new AppError(
          'This fields title, type and value cannot be empty.',
        );
      }
      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const exitentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = exitentCategories.map(
      (category: Category) => category.title,
    );

    // Pego todas as categories que não estão no banco
    const addCategoryTitle = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitle.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);

    const finalcategories = [...newCategories, ...exitentCategories];

    const createTrasactions = transactionRepository.create(
      transactions.map(trasaction => ({
        title: trasaction.title,
        type: trasaction.type,
        value: trasaction.value,
        category: finalcategories.find(
          category => category.title === trasaction.category,
        ),
      })),
    );

    await transactionRepository.save(createTrasactions);

    await fs.promises.unlink(filePath);

    return createTrasactions;
  }
}

export default ImportTransactionsService;
