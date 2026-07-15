/** Reprice packs in $ Pikadollars and top up broke demo users. */
const { PrismaClient } = require("@prisma/client");

function packPriceForSet(setId, series) {
  if (setId === "base1") return 8;
  if (setId === "base2" || setId === "base3") return 6;
  if (setId === "base4" || setId === "base5") return 7;
  if (setId === "neo1" || (setId && setId.startsWith("gym"))) return 6;
  if (setId === "ex1" || (setId && setId.startsWith("xy"))) return 5;
  if (setId === "sv3pt5") return 7;
  if (series && String(series).toLowerCase().includes("base")) return 7;
  return 5;
}

const p = new PrismaClient();

async function main() {
  const expansions = await p.expansion.findMany();
  for (const e of expansions) {
    const cost = packPriceForSet(e.id, e.series);
    await p.expansion.update({
      where: { id: e.id },
      data: { packCost: cost },
    });
    console.log(e.id, e.name, "→", `$${cost}`);
  }

  // Cap absurd balances from old coin economy; give demo a fair bankroll
  const users = await p.user.findMany();
  for (const u of users) {
    let coins = u.coins;
    if (coins > 200) coins = 50;
    if (coins < 5) coins = 40;
    if (u.email === "demo@holovault.app") coins = Math.max(coins, 50);
    if (coins !== u.coins) {
      await p.user.update({ where: { id: u.id }, data: { coins } });
      console.log("user", u.username, u.coins, "→", coins);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
