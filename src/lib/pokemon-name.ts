/**
 * Clean display names for the vault UI.
 * "Erika's Gengar" → "Gengar"
 * "Dark Charizard" → "Charizard"
 * "Charizard ex" / "Mewtwo VMAX" → species-first readable names
 * "Galarian Rapidash" kept (regional form)
 */
export function cleanPokemonName(raw: string | null | undefined): string {
  if (!raw) return "";
  let name = raw.trim();

  // Normalize curly / fancy apostrophes
  name = name.replace(/[\u2018\u2019\u02BC\u0060]/g, "'");

  // "Team Rocket's …" / Magma / Aqua / etc.
  name = name.replace(
    /^(?:The\s+)?(?:Team\s+)?(?:Rocket|Magma|Aqua|Plasma|Galactic)'?s?\s+/i,
    ""
  );

  // Trainer possessives: "Erika's ", "Brock's ", "Lt. Surge's ", "Sabrina's "
  name = name.replace(
    /^(?:Lt\.?\s+)?[A-Za-z][A-Za-z.-]*(?:\s+[A-Za-z][A-Za-z.-]*)?'s\s+/i,
    ""
  );
  name = name.replace(/^[A-Za-z][A-Za-z.-]*'s\s+/i, "");

  // Rocket / special variants
  name = name.replace(/^(?:Dark|Light|Shining|Crystal)\s+/i, "");

  // "M Charizard-EX" / "M Rayquaza-EX" → "Mega Charizard" style
  name = name.replace(/^M\s+/i, "Mega ");

  // Hyphen EX/GX leftovers: "Charizard-EX" → "Charizard"
  name = name.replace(/-(?:EX|GX|VMAX|VSTAR|V)\s*$/i, "");

  // Battle / product suffixes (keep regional prefixes like Galarian/Alolan)
  name = name.replace(
    /\s+(?:ex|EX|GX|VMAX|VSTAR|V-UNION|V|BREAK|LV\.?X|Prime|LEGEND|Radiant|δ|Delta)\s*$/i,
    ""
  );

  // Full-art / promo noise
  name = name.replace(/\s*\((?:Full Art|Secret|Promo|Holo)\)\s*$/i, "");
  name = name.replace(/\s+◇\s*$/u, "");

  // Title case cleanup if all caps
  if (name.length > 2 && name === name.toUpperCase() && /[A-Z]/.test(name)) {
    name = name
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return name.replace(/\s+/g, " ").trim() || raw.trim();
}

/** True if this looks like a creature card name (not a pure Trainer item). */
export function looksLikePokemonName(name: string): boolean {
  const lower = name.toLowerCase();
  if (
    /^(potion|energy|bill|professor|switch|gust|item|supporter|stadium)/i.test(
      lower
    )
  ) {
    return false;
  }
  return true;
}
