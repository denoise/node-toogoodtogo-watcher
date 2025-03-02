import _ from "lodash";
import got from "got";
import { CookieJar } from "tough-cookie";
import { config } from "./config.js";

const api = got.extend({
  cookieJar: new CookieJar(),
  prefixUrl: "https://apptoogoodtogo.com/api/",
  headers: _.defaults(config.get("api.headers"), {
    "User-Agent":
      "TooGoodToGo/25.2.0 (36740) (iPhone/iPhone 13; iOS 18.3.1; Scale/3.00/iOS)",
    "Content-Type": "application/json; charset=utf-8",
    Accept: "application/json",
    "Accept-Language": "en-US",
    "Accept-Encoding": "gzip",
  }),
  responseType: "json",
  resolveBodyOnly: true,
  retry: {
    limit: 2,
    methods: ["GET", "POST", "PUT", "HEAD", "DELETE", "OPTIONS", "TRACE"],
    statusCodes: [401, 403, 408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
  },
});
export function authByEmail() {
  const credentials = config.get("api.credentials");

  return api.post("auth/v5/authByEmail", {
    json: {
      device_type: config.get("api.deviceType", "IOS"),
      email: credentials.email,
    },
  });
}

export function authPoll(polling_id) {
  const credentials = config.get("api.credentials");

  return api
    .post("auth/v5/authByRequestPollingId", {
      json: {
        device_type: config.get("api.deviceType", "IOS"),
        email: credentials.email,
        request_polling_id: polling_id,
      },
    })
    .then(createSession);
}

export function login() {
  const session = getSession();
  if (session.accessToken) {
    // Instead of trying to refresh the token, just return the current session
    // The access token has a TTL of 48 hours, which should be enough for normal operation
    return Promise.resolve({
      access_token: session.accessToken,
      refresh_token: session.refreshToken
    });
  }
  throw "You are not logged in. Login via the command `toogoodtogo-watcher login` or `/login` with the Telegram Bot";
}

export function listFavoriteBusinesses() {
  const session = getSession();
  console.log("Listing favorite businesses with access token:", session.accessToken);

  return api.post("item/v8/", {
    json: {
      favorites_only: true,
      origin: {
        latitude: 52.5170365,
        longitude: 13.3888599,
      },
      radius: 200,
    },
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  })
  .then(response => {
    console.log("Got response from item/v8/:", response.items ? response.items.length : "no items");
    return response;
  })
  .catch(error => {
    console.error("Error listing favorite businesses:", error.message);
    throw error;
  });
}

function getSession() {
  return config.get("api.session") || {};
}

function createSession(login) {
  if (login) {
    config.set("api.session", {
      accessToken: login.access_token,
      refreshToken: login.refresh_token,
    });
  }
  return login;
}

function updateSession(token) {
  config.set("api.session.accessToken", token.access_token);
  return token;
}
