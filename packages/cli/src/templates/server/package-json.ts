export default `{
  "name": "@{{PROJECT_NAME}}/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@aws-sdk/client-cloudfront": "^3.787.0",
    "@aws-sdk/client-dynamodb": "^3.787.0",
    "@aws-sdk/client-kms": "^3.787.0",
    "@aws-sdk/lib-dynamodb": "^3.787.0",
    "aws-jwt-verify": "^5.0.0",
    "aws-lambda": "^1.0.7"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.145",
    "@types/node": "^22.10.5",
    "typescript": "^5.7.2",
    "vitest": "^3.0.0"
  }
}
`;
