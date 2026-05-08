export default `import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { CognitoAccessTokenPayload } from 'aws-jwt-verify/jwt-model';

/**
 * Cognito access token verifier using aws-jwt-verify.
 *
 * Uses cached JWKS fetching — the verifier fetches the public key once and
 * caches it in module scope. Lambda warm starts re-use the cached verifier.
 *
 * This verifier handles SPA-direct calls (Authorization: Bearer <cognito-token>)
 * on /content/* routes, where API Gateway's built-in JWT authorizer is not used
 * (because the same routes also accept KMS-signed overlay tokens from inline
 * editor saves — two issuers, one route, in-handler dispatch required).
 */

let _verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!_verifier) {
    const userPoolId = required('{{PROJECT_NAME_UPPER}}_USER_POOL_ID');
    const clientId = required('{{PROJECT_NAME_UPPER}}_COGNITO_CLIENT_ID');
    _verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId,
    });
  }
  return _verifier;
}

export async function verifyCognitoAccessToken(
  token: string,
): Promise<CognitoAccessTokenPayload | null> {
  try {
    return await getVerifier().verify(token);
  } catch {
    return null;
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(\`missing required env var: \${name}\`);
  return v;
}
`;
