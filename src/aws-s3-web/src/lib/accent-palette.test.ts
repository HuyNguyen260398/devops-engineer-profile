import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const productionAssets = ["src/app/globals.css", "public/avatar-placeholder.svg"];
const legacyAccentPatterns = [
  /#(?:e65320|ff784c|f78166|ffa198|bc4c00|ff853f|ff9c7c|ca6f4e|ff6b39|ef835d|f08b67|ef8d6c|d98d73|efb19b|d38a71|df8667|e8b6a5|c38c9c)/gi,
  /#(?:5b8cff|70a1ff|71a1ff|76a1ff)/gi,
  /230\s*,\s*83\s*,\s*32/g,
  /247\s*,\s*129\s*,\s*102/g,
  /188\s*,\s*76\s*,\s*0/g,
  /91\s*,\s*140\s*,\s*255/g,
];

it("contains no legacy non-GitHub accent literals", () => {
  const violations = productionAssets.flatMap((file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    return legacyAccentPatterns.flatMap((pattern) =>
      Array.from(source.matchAll(pattern), (match) => `${file}: ${match[0]}`),
    );
  });

  expect(violations).toEqual([]);
});
