import _ from "lodash";
import { combineLatest, from, of, timer } from "rxjs";
import { catchError, filter, map, mergeMap, retry } from "rxjs/operators";
import { config } from "./config.js";
import { login, listFavoriteBusinesses } from "./toogoodtogo-api.js";

const MINIMAL_POLLING_INTERVAL = 15000;
const MINIMAL_AUTHENTICATION_INTERVAL = 3600000;

export function pollFavoriteBusinesses$(enabled$) {
  const authenticationByInterval$ = authenticateByInterval$();
  return listFavoriteBusinessesByInterval$(authenticationByInterval$, enabled$);
}

function authenticateByInterval$() {
  const authenticationIntervalInMs = getInterval(
    "api.authenticationIntervalInMS",
    MINIMAL_AUTHENTICATION_INTERVAL
  );

  console.log("Authentication interval:", authenticationIntervalInMs, "ms");

  return timer(0, authenticationIntervalInMs).pipe(
    mergeMap(() => {
      console.log("Authenticating...");
      return from(login()).pipe(
        retry(2),
        catchError(logError),
        filter((authentication) => {
          console.log("Authentication result:", !!authentication);
          return !!authentication;
        })
      );
    })
  );
}

function listFavoriteBusinessesByInterval$(
  authenticationByInterval$,
  enabled$
) {
  const pollingIntervalInMs = getInterval(
    "api.pollingIntervalInMs",
    MINIMAL_POLLING_INTERVAL
  );

  console.log("Polling interval:", pollingIntervalInMs, "ms");

  return combineLatest([
    enabled$,
    timer(0, pollingIntervalInMs),
    authenticationByInterval$,
  ]).pipe(
    filter(([enabled]) => {
      console.log("Enabled:", enabled);
      return enabled;
    }),
    mergeMap(() => {
      console.log("Listing favorite businesses...");
      return from(listFavoriteBusinesses()).pipe(
        retry(2),
        catchError(logError),
        filter((response) => {
          const hasItems = !!_.get(response, "items");
          console.log("Has items:", hasItems);
          return hasItems;
        }),
        map((response) => {
          console.log("Returning items:", response.items.length);
          return response.items;
        })
      );
    })
  );
}

function logError(error) {
  if (error.options) {
    console.error(`Error during request:
${error.options.method} ${error.options.url.toString()}
${JSON.stringify(error.options.json, null, 4)}

${error.stack}`);
  } else if (error.stack) {
    console.error(error.stack);
  } else {
    console.error(error);
  }
  return of(null);
}

function getInterval(configPath, minimumIntervalInMs) {
  const configuredIntervalInMs = config.get(configPath);
  return _.isFinite(configuredIntervalInMs)
    ? Math.max(configuredIntervalInMs, minimumIntervalInMs)
    : minimumIntervalInMs;
}
