const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const gym = await p.card.findMany({
    where: { setId: "gym1" },
    take: 25,
    select: { name: true },
  });
  console.log("gym1 sample:");
  gym.forEach((x) => console.log(" ", x.name));

  const still = await p.card.findMany({
    where: {
      OR: [
        { name: { contains: "'s " } },
        { name: { contains: "’s " } },
        { name: { contains: "Dark " } },
      ],
    },
    take: 30,
    select: { name: true, setId: true },
  });
  console.log("\nstill prefixed:", still.length);
  still.forEach((x) => console.log(" ", x.setId, x.name));
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
