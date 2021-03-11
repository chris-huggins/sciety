import * as Eq from 'fp-ts/Eq';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

// TODO choose one or the other
const doiRegex = /^(?:doi:)?(10\.[0-9]{4,}(?:\.[1-9][0-9]*)*\/(?:[^%"#?\s])+)$/;

export class Doi {
  readonly value: string;

  constructor(input: string) {
    const [, doi] = doiRegex.exec(input) ?? [];

    if (!doi) {
      throw new Error(`'${input}' is not a possible DOI`);
    }

    this.value = doi;
  }

  hasPrefix(prefix: string): boolean {
    return this.value.startsWith(`${prefix}/`);
  }

  toString(): string {
    return `doi:${this.value}`;
  }
}

export const fromString = (value: string): O.Option<Doi> => O.tryCatch(() => new Doi(value));

export const hasPrefix = (prefix: string) => (doi: Doi): boolean => doi.hasPrefix(prefix);

export const eqDoi: Eq.Eq<Doi> = pipe(
  Eq.eqString,
  Eq.contramap((doi) => doi.value),
);
