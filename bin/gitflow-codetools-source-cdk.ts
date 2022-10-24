#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GitflowCodetoolsSourceCdkStack } from '../lib/gitflow-codetools-source-cdk-stack';
import { RepoCdkStack } from '../lib/repo-cdk-stack'
import { PipelineCdkStack } from '../lib/pipeline-cdk-stack'
import { BranchCreateCdkStack } from '../lib/branch-create-cdk-stack';

const app = new cdk.App();

const repositoryName = "Gitflow-Workshop";
const branch_name = process.env.TEMPLATE_REFERENCE_NAME || "FeatureBranch";

new RepoCdkStack(app, 'gitflow-repo-stack', {repositoryName: repositoryName});
new BranchCreateCdkStack(app, 'branch-create-codebuild', {repositoryName: repositoryName});
new PipelineCdkStack(app, repositoryName + branch_name, {repositoryName: repositoryName, branchName: branch_name});


new GitflowCodetoolsSourceCdkStack(app, 'GitflowCodetoolsSourceCdkStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
