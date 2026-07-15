const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  // Ensure demo has coins
  await p.user.updateMany({
    where: { email: "demo@holovault.app" },
    data: { coins: 5000 },
  });
  console.log("demo coins topped up");
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
