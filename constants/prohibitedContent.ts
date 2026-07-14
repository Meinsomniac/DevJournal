export interface ProhibitedCategory {
  name: string;
  label: string;
  keywords: string[];
}

export const PROHIBITED_CATEGORIES: ProhibitedCategory[] = [
  {
    name: 'riba',
    label: 'Interest & Usury',
    keywords: [
      'interest rate', 'usury', 'riba', 'interest loan', 'payday loan',
      'interest-bearing', 'predatory lending',
      'subprime mortgage',
    ],
  },
  {
    name: 'gambling',
    label: 'Gambling',
    keywords: [
      'casino', 'poker', 'blackjack', 'roulette', 'slot machine',
      'betting', 'sports betting', 'online gambling', 'lottery',
      'wagering', 'bookmaker',
    ],
  },
  {
    name: 'adult',
    label: 'Adult Content',
    keywords: [
      'porn', 'xxx', 'adult content', 'onlyfans',
      'escort', 'nsfw',
    ],
  },
  {
    name: 'intoxicants',
    label: 'Alcohol & Intoxicants',
    keywords: [
      'alcohol delivery', 'liquor store', 'wine club', 'beer delivery',
      'distillery', 'brewery', 'spirits', 'vodka', 'whiskey',
    ],
  },
  {
    name: 'haram_food',
    label: 'Restricted Foods',
    keywords: [
      'pork', 'bacon', 'ham', 'prosciutto',
    ],
  },
  {
    name: 'superstition',
    label: 'Superstition & Divination',
    keywords: [
      'astrology', 'horoscope', 'fortune teller', 'tarot',
      'palm reading', 'psychic reading', 'black magic',
      'sorcery', 'witchcraft', 'occult',
    ],
  },
];
