const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const cards = await p.card.count();
  const exp = await p.expansion.count();
  const by = await p.card.groupBy({
    by: ["setId"],
    _count: true,
    orderBy: { _count: { setId: "desc" } },
    take: 10,
  });
  console.log(JSON.stringify({ cards, exp, top: by }, null, 2));
  const c = await p.card.findFirst({
    where: { name: "Charizard" },
    select: { name: true, imageSmall: true, setName: true },
  });
  console.log("sample", c);
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
