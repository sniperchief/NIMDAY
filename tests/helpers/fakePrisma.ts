/**
 * Tiny in-memory stand-in for the Prisma client — just enough of the surface
 * that the birthday / wish / publish routes use. Lets the full server flow be
 * tested hermetically (no database).
 */
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;

function match(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && "lt" in (v as Row)) {
      return (row[k] as number) < ((v as Row).lt as number);
    }
    return row[k] === v;
  });
}

class Table {
  rows: Row[] = [];
  constructor(
    private name: string,
    private defaults: Row = {},
  ) {}

  private now() {
    return new Date();
  }

  async create({ data, include }: { data: Row; include?: Row }) {
    const row: Row = {
      id: (data.id as string) ?? randomUUID(),
      createdAt: this.now(),
      updatedAt: this.now(),
      ...this.defaults,
      ...data,
    };
    // nested wishes.create
    if (data.wishes && typeof data.wishes === "object") {
      delete row.wishes;
      const nested = (data.wishes as { create: Row[] }).create ?? [];
      this.rows.push(row);
      for (const w of nested) {
        await FAKE.wish.create({ data: { birthdayId: row.id, ...w } });
      }
    } else {
      this.rows.push(row);
    }
    return this.decorate(row, include);
  }

  async findUnique({ where, include }: { where: Row; include?: Row }) {
    const row = this.rows.find((r) => match(r, where));
    return row ? this.decorate(row, include) : null;
  }

  async findUniqueOrThrow(args: { where: Row; include?: Row }) {
    const row = await this.findUnique(args);
    if (!row) throw new Error(`${this.name} not found`);
    return row;
  }

  async count({ where }: { where?: Row } = {}) {
    return this.rows.filter((r) => match(r, where)).length;
  }

  async update({ where, data, include }: { where: Row; data: Row; include?: Row }) {
    const row = this.rows.find((r) => match(r, where));
    if (!row) throw new Error("not found");
    Object.assign(row, data, { updatedAt: this.now() });
    return this.decorate(row, include);
  }

  async updateMany({ where, data }: { where: Row; data: Row }) {
    const rows = this.rows.filter((r) => match(r, where));
    rows.forEach((r) => Object.assign(r, data));
    return { count: rows.length };
  }

  async delete({ where }: { where: Row }) {
    const i = this.rows.findIndex((r) => match(r, where));
    if (i < 0) throw new Error("not found");
    const [row] = this.rows.splice(i, 1);
    return row;
  }

  async deleteMany({ where }: { where?: Row } = {}) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !match(r, where));
    return { count: before - this.rows.length };
  }

  async upsert({ where, create, update }: { where: Row; create: Row; update: Row }) {
    const row = this.rows.find((r) => match(r, where));
    if (row) {
      Object.assign(row, update, { updatedAt: this.now() });
      return row;
    }
    return this.create({ data: { ...where, ...create } });
  }

  private decorate(row: Row, include?: Row): Row {
    if (!include) return { ...row };
    const out = { ...row };
    if (include.wishes) {
      out.wishes = FAKE.wish.rows.filter((w) => w.birthdayId === row.id);
    }
    if (include.birthday) {
      out.birthday = FAKE.birthday.rows.find((b) => b.id === row.birthdayId);
    }
    return out;
  }
}

export const FAKE = {
  user: new Table("user"),
  birthday: new Table("birthday", {
    published: false,
    publishedAt: null,
    message: null,
    imageUrl: null,
    theme: "confetti",
  }),
  wish: new Table("wish", {
    currency: "NIM",
    giftType: "EITHER",
    sortOrder: 0,
    description: null,
    imageUrl: null,
  }),
  authNonce: new Table("authNonce"),
  reset() {
    this.user.rows = [];
    this.birthday.rows = [];
    this.wish.rows = [];
    this.authNonce.rows = [];
  },
};
