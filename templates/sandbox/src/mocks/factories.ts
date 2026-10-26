import { faker } from "@faker-js/faker";

faker.seed(42);

export function list<T>(n: number, make: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => make(i));
}

export function money(min: number, max: number): number {
  return faker.number.int({ min, max });
}

export function person() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    avatar: faker.image.avatar(),
  };
}

export function order() {
  return {
    id: faker.string.alphanumeric(8).toUpperCase(),
    customer: person(),
    total: money(10, 5000),
    status: faker.helpers.arrayElement(["new", "paid", "shipped", "cancelled"] as const),
    createdAt: faker.date.recent({ days: 60 }).toISOString(),
  };
}
