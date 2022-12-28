import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
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
                nodejs: 16

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
                echo "INFO: Configuring build parameters ..."
                set -eu
                export STACK_NAME="\${TEMPLATE_STACK_PREFIX}\${TEMPLATE_REFERENCE_NAME}"
            - |-
                echo "INFO: Synthesizing CDK resources ..."
                set -eu
                npm run build
                npx cdk ls
                npx cdk synth -e \${STACK_NAME}
            - |-
                echo "INFO: Deploying Application ..."
                    npx cdk diff -e \${STACK_NAME}
                    npx cdk deploy -e --require-approval=never \${STACK_NAME}App

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

  }
}
