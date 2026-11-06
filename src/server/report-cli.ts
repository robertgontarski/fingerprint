import { loadConfig } from './config.ts';
import { createRepository } from './db/repository.ts';
import { openDatabase } from './db/schema.ts';
import { buildLabModel, loadLabData } from './lab.ts';

const config = loadConfig(process.env);
const database = openDatabase(config.databasePath);
const { collisions, drift, matches, pairs, orderCount } = buildLabModel(
  loadLabData(createRepository(database, () => new Date())),
);
database.close();

const percent = (part: number, whole: number): string => (whole === 0 ? '-' : `${Math.round((part / whole) * 100)}%`);

const lines = [
  `Orders: ${orderCount}`,
  `Identified visitors: ${collisions.identifiedVisitors}`,
  `Stable fingerprint collisions: ${collisions.sharedStableKeys} of ${collisions.distinctStableKeys} (visitors on a collision: ${collisions.visitorsOnSharedKeys})`,
  `Drift: stable ${drift.stableKeyChanged}, full ${drift.fullKeyChanged} across ${drift.visitorsWithRepeatVisits} visitors with repeat observations`,
  `Top candidate correct: ${matches.topCandidateCorrect} of ${matches.evaluated} (${percent(matches.topCandidateCorrect, matches.evaluated)})`,
  `Confident matches: ${matches.confidentCorrect} correct of ${matches.confident} (precision ${percent(matches.confidentCorrect, matches.confident)})`,
  `Cross-domain pairs: ${pairs.length}`,
  ...pairs.map(
    ({ left, right, comparison }) =>
      `  ${left.visitor.site}:${left.visitor.id.slice(0, 8)} and ${right.visitor.site}:${right.visitor.id.slice(0, 8)} - ${Math.round(comparison.score * 100)}%`,
  ),
];

process.stdout.write(`${lines.join('\n')}\n`);
