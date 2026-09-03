import { describe, it, expect, vi, beforeEach } from "vitest";
import { FAKE } from "../helpers/fakePrisma";

const { currentUser } = vi.hoisted(() => ({
  currentUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: FAKE }));
vi.mock("@/lib/auth/currentUser", () => ({ getCurrentUser: currentUser }));

import { POST as createBirthday } from "@/app/api/birthdays/route";
import { POST as publishBirthday } from "@/app/api/birthdays/[id]/publish/route";
import { POST as addWish } from "@/app/api/birthdays/[id]/wishes/route";
import { PATCH as patchWish } from "@/app/api/wishes/[id]/route";
import { getPublishedBirthdayBySlug, toPublicBirthday } from "@/lib/birthday";

function jsonReq(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const OWNER = { id: "user-owner", walletAddress: "NQ01 OWNER" };
const STRANGER = { id: "user-stranger", walletAddress: "NQ01 STRANGER" };

const validBirthday = {
  name: "Sarah",
  birthday: "2000-09-13",
  message: "Come celebrate!",
  theme: "confetti",
  wishes: [
    { title: "Headphones", targetAmount: 120, currency: "NIM", giftType: "FUND" },
    { title: "Book", targetAmount: 20, currency: "NIM", giftType: "EITHER" },
  ],
};

beforeEach(() => {
  FAKE.reset();
  currentUser.mockReset();
});

describe("creator flow: create → publish → public view", () => {
  it("runs the whole happy path", async () => {
    currentUser.mockResolvedValue(OWNER);

    // create
    const createRes = await createBirthday(jsonReq(validBirthday));
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()).data.birthday;
    expect(created.slug).toMatch(/^sarah-/);
    expect(created.wishes).toHaveLength(2);
    expect(created.published).toBe(false);

    // not publicly visible yet
    expect(await getPublishedBirthdayBySlug(created.slug)).toBeNull();

    // publish
    const pubRes = await publishBirthday(jsonReq({}), ctx(created.id));
    expect(pubRes.status).toBe(200);
    const pubBody = (await pubRes.json()).data;
    expect(pubBody.birthday.published).toBe(true);
    expect(pubBody.url).toContain(`/b/${created.slug}`);

    // now visible, and serialises for the public page
    const row = await getPublishedBirthdayBySlug(created.slug);
    expect(row).not.toBeNull();
    const pub = toPublicBirthday(row!);
    expect(pub.name).toBe("Sarah");
    expect(pub.wishes.map((w) => w.title)).toEqual(["Headphones", "Book"]);
  });

  it("rejects a second NIMday for the same creator (409)", async () => {
    currentUser.mockResolvedValue(OWNER);
    await createBirthday(jsonReq(validBirthday));
    const res = await createBirthday(jsonReq(validBirthday));
    expect(res.status).toBe(409);
  });

  it("blocks a 6th wish at the route level", async () => {
    currentUser.mockResolvedValue(OWNER);
    const created = (
      await (await createBirthday(jsonReq({ ...validBirthday, wishes: [] }))).json()
    ).data.birthday;

    for (let i = 0; i < 5; i++) {
      const r = await addWish(
        jsonReq({ title: `w${i}`, targetAmount: 10, currency: "NIM", giftType: "EITHER" }),
        ctx(created.id),
      );
      expect(r.status).toBe(201);
    }
    const sixth = await addWish(
      jsonReq({ title: "w6", targetAmount: 10, currency: "NIM", giftType: "EITHER" }),
      ctx(created.id),
    );
    expect(sixth.status).toBe(409);
  });

  it("stops a stranger from editing someone else's wish (403)", async () => {
    currentUser.mockResolvedValue(OWNER);
    const created = (
      await (await createBirthday(jsonReq(validBirthday))).json()
    ).data.birthday;
    const wishId = created.wishes[0].id;

    currentUser.mockResolvedValue(STRANGER);
    const res = await patchWish(jsonReq({ title: "hacked" }), ctx(wishId));
    expect(res.status).toBe(403);
  });

  it("won't publish an incomplete NIMday", async () => {
    currentUser.mockResolvedValue(OWNER);
    // create with an invalid wish sneaked straight into the store
    const created = (
      await (await createBirthday(jsonReq({ ...validBirthday, wishes: [] }))).json()
    ).data.birthday;
    FAKE.wish.rows.push({
      id: "bad",
      birthdayId: created.id,
      title: "",
      targetAmount: 0,
      currency: "NIM",
      giftType: "EITHER",
      sortOrder: 0,
    });
    const res = await publishBirthday(jsonReq({}), ctx(created.id));
    expect(res.status).toBe(400);
    expect((await res.json()).error.problems.length).toBeGreaterThan(0);
  });

  it("requires authentication to create", async () => {
    currentUser.mockResolvedValue(null);
    const res = await createBirthday(jsonReq(validBirthday));
    expect(res.status).toBe(401);
  });
});
