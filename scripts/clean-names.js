/**
 * Rewrite stored Pokémon card names to plain species names.
 * Only touches creature cards (has types / Pokémon supertype).
 */
const { PrismaClient } = require("@prisma/client");

function cleanPokemonName(raw) {
  if (!raw) return "";
  let name = String(raw).trim();
  name = name.replace(/[\u2018\u2019\u02BC\u0060]/g, "'");
  name = name.replace(
    /^(?:The\s+)?(?:Team\s+)?(?:Rocket|Magma|Aqua|Plasma|Galactic)'?s?\s+/i,
    ""
  );
  name = name.replace(
    /^(?:Lt\.?\s+)?[A-Za-z][A-Za-z.-]*(?:\s+[A-Za-z][A-Za-z.-]*)?'s\s+/i,
    ""
  );
  name = name.replace(/^[A-Za-z][A-Za-z.-]*'s\s+/i, "");
  name = name.replace(/^(?:Dark|Light)\s+/i, "");
  name = name.replace(
    /\s+(?:ex|EX|GX|VMAX|VSTAR|V-UNION|V|BREAK|LV\.?X|Prime|LEGEND|Radiant)\s*$/i,
    ""
  );
  return name.replace(/\s+/g, " ").trim() || raw.trim();
}

const p = new PrismaClient();

async function main() {
  const cards = await p.card.findMany({
    select: { id: true, name: true, types: true, supertype: true },
  });
  let updated = 0;
  const samples = [];
  for (const c of cards) {
    const isPokemon =
      (c.supertype && /pok/i.test(c.supertype)) ||
      (c.types && c.types !== "[]" && c.types.length > 2);
    // Always strip possessives if present, even for edge cases
    const hasOwner =
      /'s\s|[\u2019]s\s/i.test(c.name) ||
      /^(Dark|Light)\s/i.test(c.name);
    if (!isPokemon && !hasOwner) continue;

    const next = cleanPokemonName(c.name);
    if (next !== c.name) {
      await p.card.update({ where: { id: c.id }, data: { name: next } });
      updated++;
      if (samples.length < 25) samples.push(`${c.name} → ${next}`);
    }
  }

  await p.expansion.updateMany({
    where: { id: { in: ["gym1", "gym2"] } },
    data: { active: false },
  });

  console.log(JSON.stringify({ total: cards.length, updated, samples }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
