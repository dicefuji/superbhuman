import { describe, expect, it } from "vitest";

import {
  getConfiguredGoogleClientId,
  getMissingGoogleScopes,
  getRequiredGoogleScopes,
  hasConfiguredGoogleOAuth,
  hasRequiredGoogleScopes
} from "./googleAuth";

describe("googleAuth helpers", () => {
  it("reads the manifest oauth configuration", () => {
    expect(
      hasConfiguredGoogleOAuth({
        oauth2: {
          client_id: "client-id.apps.googleusercontent.com",
          scopes: ["scope:a"]
        }
      })
    ).toBe(true);
    expect(getConfiguredGoogleClientId({ oauth2: { client_id: "client-id.apps.googleusercontent.com" } })).toBe(
      "client-id.apps.googleusercontent.com"
    );
    expect(getRequiredGoogleScopes({ oauth2: { scopes: ["scope:a"] } })).toEqual(["scope:a"]);
  });

  it("computes missing scopes from a granted scope list", () => {
    expect(getMissingGoogleScopes(["scope:a"], ["scope:a", "scope:b"])).toEqual(["scope:b"]);
  });

  it("checks if a session has the required scopes", () => {
    expect(hasRequiredGoogleScopes({ grantedScopes: ["scope:a", "scope:b"] }, ["scope:a"])).toBe(true);
    expect(hasRequiredGoogleScopes({ grantedScopes: ["scope:a"] }, ["scope:a", "scope:b"])).toBe(false);
  });
});
