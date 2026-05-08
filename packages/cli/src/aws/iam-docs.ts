export function oidcTrustPolicy(accountId: string, orgRepo: string, branch: string): object {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Federated: `arn:aws:iam::${accountId}:oidc-provider/token.actions.githubusercontent.com`,
        },
        Action: 'sts:AssumeRoleWithWebIdentity',
        Condition: {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${orgRepo}:ref:refs/heads/${branch}`,
          },
        },
      },
    ],
  };
}

export function deployerRoleInlinePolicy(accountId: string, projectName: string): object {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'SSTBootstrap',
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        Resource: ['arn:aws:s3:::sst-asset-*', 'arn:aws:s3:::sst-asset-*/*'],
      },
      {
        Sid: 'CloudFormationDeploy',
        Effect: 'Allow',
        Action: [
          'cloudformation:CreateStack',
          'cloudformation:UpdateStack',
          'cloudformation:DeleteStack',
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
          'cloudformation:DescribeStackResource',
          'cloudformation:GetTemplate',
          'cloudformation:ListStackResources',
          'cloudformation:ValidateTemplate',
        ],
        Resource: `arn:aws:cloudformation:*:${accountId}:stack/${projectName}-*`,
      },
      {
        Sid: 'PassRoleToLambda',
        Effect: 'Allow',
        Action: 'iam:PassRole',
        Resource: `arn:aws:iam::${accountId}:role/${projectName}-*`,
        Condition: {
          StringEquals: {
            'iam:PassedToService': 'lambda.amazonaws.com',
          },
        },
      },
      {
        Sid: 'ManageProjectResources',
        Effect: 'Allow',
        Action: [
          'lambda:*',
          'dynamodb:*',
          's3:*',
          'cognito-idp:*',
          'kms:Create*',
          'kms:Describe*',
          'kms:Enable*',
          'kms:List*',
          'kms:Put*',
          'kms:Disable*',
          'kms:Delete*',
          'kms:TagResource',
          'kms:UntagResource',
          'cloudfront:*',
          'acm:*',
          'route53:*',
          'apigateway:*',
          'logs:*',
        ],
        Resource: '*',
      },
      {
        Sid: 'IAMProjectRoles',
        Effect: 'Allow',
        Action: [
          'iam:CreateRole',
          'iam:DeleteRole',
          'iam:AttachRolePolicy',
          'iam:DetachRolePolicy',
          'iam:PutRolePolicy',
          'iam:DeleteRolePolicy',
          'iam:GetRole',
          'iam:GetRolePolicy',
          'iam:ListRolePolicies',
          'iam:ListAttachedRolePolicies',
          'iam:TagRole',
          'iam:UntagRole',
        ],
        Resource: `arn:aws:iam::${accountId}:role/${projectName}-*`,
      },
    ],
  };
}

export function localDevUserPolicy(projectName: string): object {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'SSTDev',
        Effect: 'Allow',
        Action: [
          's3:GetObject',
          's3:PutObject',
          's3:ListBucket',
          'cloudformation:*',
          'lambda:*',
          'dynamodb:*',
          'cognito-idp:*',
          'kms:*',
          'cloudfront:*',
          'acm:*',
          'apigateway:*',
          'logs:*',
          'iam:*',
          'sts:GetCallerIdentity',
        ],
        Resource: '*',
        Condition: {
          StringEquals: {
            'aws:RequestedRegion': 'us-west-2',
          },
        },
      },
    ],
  };
}
