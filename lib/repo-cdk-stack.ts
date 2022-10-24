import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';

interface RepoStackProps extends StackProps {
  readonly repositoryName: string;
}

export class RepoCdkStack extends Stack {
  constructor(scope: Construct, id: string, props: RepoStackProps) {
    super(scope, id, props);

    const sourceRepo = new codecommit.Repository(this, 'Gitflow_Workshop', {
      repositoryName: props.repositoryName,
      description: 'Repository for my application code and infrastructure',
    });

    new CfnOutput(this, 'CodeCommitRepositoryUrl', { value: sourceRepo.repositoryCloneUrlHttp });
  }
}
