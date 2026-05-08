export default `{
  "name": "@{{PROJECT_NAME}}/infra",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "deploy:dev": "sst deploy --stage dev",
    "deploy:prod": "sst deploy --stage prod",
    "remove:dev": "sst remove --stage dev"
  },
  "devDependencies": {
    "sst": "^3.0.0",
    "aws-cdk-lib": "^2.0.0",
    "constructs": "^10.0.0"
  }
}
`;
