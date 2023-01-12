import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as yaml from 'yaml';

import { EventField, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { CodeBuildProject } from 'aws-cdk-lib/aws-events-targets';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';


interface BranchCreateStackProps extends StackProps {
    readonly repositoryName: string;
}

export class BranchCreateCdkStack extends Stack {
  constructor(scope: Construct, id: string, props: BranchCreateStackProps) {
    super(scope, id, props);

    const sourceRepo = codecommit.Repository.fromRepositoryName(this, "sourceRepo", props.repositoryName);

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
                    - printenv | sort
                    - |-
                        echo "INFO: Validating CodeCommit branch ..."
                        set -eu
                        case "\${TEMPLATE_REFERENCE_NAME:-}" in
                        "main" | "develop" )
                            echo >&2 "=============================================================="
                            echo >&2 "WARNING: protected branch (\${TEMPLATE_REFERENCE_NAME})"
                            echo >&2 "=============================================================="
                            ;;
                        ""        )
                            echo >&2 "=============================================================="
                            echo >&2 "ERROR: branch name required"
                            echo >&2 "=============================================================="
                            exit 1
                            ;;
                        esac
                    - |-
                        echo "INFO: Validating CodeCommit event ..."
                        set -eu
                        case "\${TEMPLATE_EVENT:-}" in
                        "referenceCreated" | "referenceDeleted" )
                            true
                            ;;
                        *)
                            echo >&2 "=============================================================="
                            echo >&2 "ERROR: unsupported event (\${TEMPLATE_EVENT})"
                            echo >&2 "=============================================================="
                            exit 1
                            ;;
                        esac
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
                    echo "INFO: Mutating CDK stack ..."
                    set -eu
                    case "\${TEMPLATE_EVENT:-}" in
                    "referenceCreated" )
                        echo "=============================================================="
                        echo "WARNING: Creating stack (\${STACK_NAME})"
                        echo "=============================================================="
                        npx cdk diff -e \${STACK_NAME}
                        npx cdk deploy -e --require-approval=never \${STACK_NAME}
                        ;;
                    "referenceDeleted" )
                        echo "=============================================================="
                        echo "WARNING: Destroying stack (\${STACK_NAME})"
                        echo "=============================================================="
                        npx cdk destroy -e --force \${STACK_NAME}App
                        npx cdk destroy -e --force \${STACK_NAME}
                        ;;
                    esac

        artifacts:
            files:
                - '**/*'
            exclude-paths:
                - './node_modules/**/*'
    `);

    // create application pipeline mutate project
    const branchProject = new codebuild.Project(this, "branchCreateProject", {
        buildSpec: codebuild.BuildSpec.fromObjectToYaml(yamlBuildspec),
        environment: {
            buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        },
        environmentVariables: {
            TEMPLATE_EVENT: {
                type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                value: '',
            },
            TEMPLATE_REPOSITORY_NAME: {
                type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                value: '',
            },
            TEMPLATE_REFERENCE_NAME: {
                type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                value: '',
            },
            TEMPLATE_REFERENCE_TYPE: {
                type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                value: '',
            },
            TEMPLATE_REFERENCE_FULL_NAME: {
                type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                value: '',
            },
            TEMPLATE_COMMIT_ID: {
                type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                value: '',
            },
            TEMPLATE_STACK_PREFIX: {
                type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                value: props.repositoryName,
            },
        },
        source: codebuild.Source.codeCommit({
            repository: sourceRepo,
            cloneDepth: 1,
        }),
        timeout: Duration.minutes(15),
        queuedTimeout: Duration.minutes(30),
    });

    // create mutate event input mapping
    const branchEventInput = RuleTargetInput.fromObject({
        environmentVariablesOverride: [
            {
                name: 'TEMPLATE_EVENT',
                value: EventField.fromPath('$.detail.event'),
            },
            {
                name: 'TEMPLATE_REPOSITORY_NAME',
                value: EventField.fromPath('$.detail.repositoryName'),
            },
            {
                name: 'TEMPLATE_REFERENCE_NAME',
                value: EventField.fromPath('$.detail.referenceName'),
            },
            {
                name: 'TEMPLATE_REFERENCE_TYPE',
                value: EventField.fromPath('$.detail.referenceType'),
            },
            {
                name: 'TEMPLATE_REFERENCE_FULL_NAME',
                value: EventField.fromPath('$.detail.referenceFullName'),
            },
            {
                name: 'TEMPLATE_COMMIT_ID',
                value: EventField.fromPath('$.detail.commitId'),
            }
        ],
    });

    // create application repository mutate event listener
    const branchEvent = sourceRepo.onEvent( props.repositoryName + "BranchChange", {
        target: new CodeBuildProject(branchProject, {
            event: branchEventInput,
        }),
        eventPattern: {
            source: ['aws.codecommit'],
            detailType: ['CodeCommit Repository State Change'],
            detail: {
                event: ['referenceCreated', 'referenceDeleted'],
                referenceType: ['branch'],
            },
        },
    });

    // allow mutate project to manage cloudformation stacks
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
    branchProject.addToRolePolicy(cfnDeployPolicy);

    // allow mutate project to assume cdk roles
    const cdkToolkitPolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            'sts:AssumeRole',
        ],
        resources: ['arn:aws:iam::*:role/cdk-*'],
    });
    branchProject.addToRolePolicy(cdkToolkitPolicy);

    // allow mutate project to use cdk staging bucket
    const cdkStagingBucketPolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            's3:*Object',
            's3:ListBucket',
            's3:GetBucketLocation',
        ],
        resources: ['arn:aws:s3:::cdktoolkit-stagingbucket-*'],
    });
    branchProject.addToRolePolicy(cdkStagingBucketPolicy);

  }
}