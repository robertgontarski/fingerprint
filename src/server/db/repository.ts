import type { DatabaseSync } from 'node:sqlite';
import type { ComponentName, Components } from '../../shared/contract.ts';
import type { PersonLink, VisitorLink, VisitorRecord } from '../domain/identity-graph.ts';
import { isPersonId, isSiteId, isVisitorId, type PersonId, type SiteId, type VisitorId } from '../domain/ids.ts';
import type { StoredObservation } from '../domain/observation.ts';
import { parseComponentList, parseComponents } from '../payload.ts';
import { asRow, branded, integer, parsedJson, text } from './rows.ts';

export type NewObservation = {
  readonly visitorId: VisitorId;
  readonly site: SiteId;
  readonly components: Components;
  readonly noisedComponents: readonly ComponentName[];
  readonly brave: boolean;
  readonly stableKey: string;
  readonly fullKey: string;
};

const toVisitor = (value: unknown): VisitorRecord => {
  const row = asRow(value);
  return { id: branded(row, 'id', isVisitorId), site: branded(row, 'site', isSiteId) };
};

const toObservation = (value: unknown): StoredObservation => {
  const row = asRow(value);
  return {
    id: integer(row, 'id'),
    visitorId: branded(row, 'visitor_id', isVisitorId),
    site: branded(row, 'site', isSiteId),
    createdAt: text(row, 'created_at'),
    components: parsedJson(row, 'components', parseComponents),
    noisedComponents: parsedJson(row, 'noised_components', parseComponentList),
    brave: integer(row, 'brave') === 1,
    stableKey: text(row, 'stable_key'),
    fullKey: text(row, 'full_key'),
  };
};

const toVisitorLink = (value: unknown): VisitorLink => {
  const row = asRow(value);
  return { from: branded(row, 'from_visitor', isVisitorId), to: branded(row, 'to_visitor', isVisitorId) };
};

const toPersonLink = (value: unknown): PersonLink => {
  const row = asRow(value);
  return { visitorId: branded(row, 'visitor_id', isVisitorId), personId: branded(row, 'person_id', isPersonId) };
};

const prepareStatements = (database: DatabaseSync) => ({
  insertVisitor: database.prepare('INSERT OR IGNORE INTO visitors (id, site, created_at) VALUES (?, ?, ?)'),
  findVisitor: database.prepare('SELECT id, site FROM visitors WHERE id = ?'),
  listVisitors: database.prepare('SELECT id, site FROM visitors ORDER BY created_at, id'),
  insertObservation: database.prepare(
    'INSERT INTO observations (visitor_id, site, created_at, components, noised_components, brave, stable_key, full_key) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ),
  listObservations: database.prepare(
    'SELECT id, visitor_id, site, created_at, components, noised_components, brave, stable_key, full_key ' +
      'FROM observations ORDER BY id',
  ),
  insertVisitorLink: database.prepare(
    'INSERT OR IGNORE INTO visitor_links (from_visitor, to_visitor, created_at) VALUES (?, ?, ?)',
  ),
  listVisitorLinks: database.prepare('SELECT from_visitor, to_visitor FROM visitor_links'),
  insertPersonLink: database.prepare(
    'INSERT OR IGNORE INTO person_links (visitor_id, person_id, created_at) VALUES (?, ?, ?)',
  ),
  listPersonLinks: database.prepare('SELECT visitor_id, person_id FROM person_links'),
  insertOrder: database.prepare('INSERT INTO orders (site, person_id, visitor_id, created_at) VALUES (?, ?, ?, ?)'),
  countOrders: database.prepare('SELECT COUNT(*) AS total FROM orders'),
  claimToken: database.prepare('INSERT OR IGNORE INTO used_handoff_tokens (token_id, used_at) VALUES (?, ?)'),
});

export const createRepository = (database: DatabaseSync, clock: () => Date) => {
  const statements = prepareStatements(database);
  const now = (): string => clock().toISOString();
  return {
    transaction: <Result>(work: () => Result): Result => {
      database.exec('BEGIN IMMEDIATE');
      try {
        const result = work();
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    ensureVisitor: (id: VisitorId, site: SiteId): void => {
      statements.insertVisitor.run(id, site, now());
    },
    findVisitor: (id: VisitorId): VisitorRecord | undefined => {
      const row: unknown = statements.findVisitor.get(id);
      return row === undefined ? undefined : toVisitor(row);
    },
    addObservation: (observation: NewObservation): number => {
      const { visitorId, site, components, noisedComponents, brave, stableKey, fullKey } = observation;
      const serialized = [JSON.stringify(components), JSON.stringify(noisedComponents)] as const;
      const result = statements.insertObservation.run(visitorId, site, now(), ...serialized, brave ? 1 : 0, stableKey, fullKey);
      return Number(result.lastInsertRowid);
    },
    linkVisitors: (from: VisitorId, to: VisitorId): void => {
      statements.insertVisitorLink.run(from, to, now());
    },
    linkPerson: (visitorId: VisitorId, personId: PersonId): void => {
      statements.insertPersonLink.run(visitorId, personId, now());
    },
    addOrder: (site: SiteId, personId: PersonId, visitorId: VisitorId | null): void => {
      statements.insertOrder.run(site, personId, visitorId, now());
    },
    claimHandoffToken: (tokenId: string): boolean => Number(statements.claimToken.run(tokenId, now()).changes) === 1,
    visitors: (): VisitorRecord[] => statements.listVisitors.all().map(toVisitor),
    observations: (): StoredObservation[] => statements.listObservations.all().map(toObservation),
    visitorLinks: (): VisitorLink[] => statements.listVisitorLinks.all().map(toVisitorLink),
    personLinks: (): PersonLink[] => statements.listPersonLinks.all().map(toPersonLink),
    orderCount: (): number => integer(asRow(statements.countOrders.get()), 'total'),
  };
};

export type Repository = ReturnType<typeof createRepository>;
