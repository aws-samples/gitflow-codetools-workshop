import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';

import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as yaml from 'yaml';

interface PipelineStackProps extends StackProps {
    readonly branchName: string;
    readonly repositoryName: string;
}

export class PipelineCdkStack extends Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const sourceRepo = codecommit.Repository.fromRepositoryName(this, "sourceRepo", props.repositoryName)

    const pipeline = new codepipeline.Pipeline(this, "CICD_Pipeline", {
      pipelineName: "CICD_Pipeline_" + props.repositoryName + "_" + props.branchName,
      crossAccountKeys: false,
    });

    const yamlBuildspec = yaml.parse(`
    version: 0.2

    env:
        shell: bash

    phases:
        install:
            runtime-versions:
                nodejs: 14

        pre_build:
            commands:
                - |-
                    echo "INFO: Installing NPM dependencies ..."
                    set -eu
                    npm install -g npm@latest
                    npm install -g cdk@latest
                    npm ci

        build:
            commands:
            - |-
                echo "INFO: Configuring App build parameters ..."
                set -eu
                export STACK_NAME="\${TEMPLATE_STACK_PREFIX}\${TEMPLATE_REFERENCE_NAME}App"
            - |-
                echo "INFO: Synthesizing CDK App resources ..."
                set -eu
                npm run build
                npx cdk ls
                npx cdk synth -e \${STACK_NAME}
            - |-
                echo "INFO: Deploying Application ..."
                    npx cdk diff -e \${STACK_NAME}
                    npx cdk deploy -e --require-approval=never \${STACK_NAME}

    artifacts:
        files:
            - '**/*'
        exclude-paths:
            - './node_modules/**/*'
    `);

    const codeDeployBuild = new codebuild.PipelineProject(
      this,
      "Code Deploy",
      {
        buildSpec: codebuild.BuildSpec.fromObjectToYaml(yamlBuildspec),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
          privileged: true,
        },
        environmentVariables: {
          TEMPLATE_REFERENCE_NAME: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.branchName,
          },
          TEMPLATE_STACK_PREFIX: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.repositoryName,
          },
        },
      },
    );

    const sourceOutput = new codepipeline.Artifact();

    pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.CodeCommitSourceAction({
          actionName: "CodeCommit",
          repository: sourceRepo,
          output: sourceOutput,
          branch: props.branchName,
        }),
      ],
    });

    pipeline.addStage({
      stageName: "Code-Deploy",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "Deploy",
          project: codeDeployBuild,
          input: sourceOutput,
        }),
      ],
    });

    // allow code deploy stage to manage cloudformation stacks
    const cfnDeployPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
          'cloudformation:DescribeStack*',
          'cloudformation:CreateChangeSet',
          'cloudformation:DescribeChangeSet',
          'cloudformation:ExecuteChangeSet',
          'cloudformation:DescribeStackEvents',
          'cloudformation:DeleteChangeSet',
          'cloudformation:GetTemplate',
      ],
      resources: ['arn:aws:cloudformation:*:*:stack/' + props.repositoryName + '*/*'],
    });
    codeDeployBuild.addToRolePolicy(cfnDeployPolicy);

    // allow code deploy stage to assume cdk roles
    const cdkToolkitPolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            'sts:AssumeRole',
        ],
        resources: ['arn:aws:iam::*:role/cdk-*'],
    });
    codeDeployBuild.addToRolePolicy(cdkToolkitPolicy);

    // allow code deploy stage to use cdk staging bucket
    const cdkStagingBucketPolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            's3:*Object',
            's3:ListBucket',
            's3:GetBucketLocation',
        ],
        resources: ['arn:aws:s3:::cdktoolkit-stagingbucket-*'],
    });
    codeDeployBuild.addToRolePolicy(cdkStagingBucketPolicy);

  }
}
