## How to leverage AWS CodeSuite tools in a Multi-Branch Model

This will

* create repo
* create codebuild pipeline creator
* on branch creation (including main) create the pipelines
* on branch delete - destroy the pipelines

To implement:
* `git clone https://github.com/aws-samples/gitflow-codetools-workshop.git`
* `cdk deploy gitflow-repo-stack`
* `cdk deploy branch-create-codebuild`
* `pip install git-remote-codecommit`
* `git remote add codecommit codecommit::<REGION>://Gitflow-Workshop`
* `git push codecommit`


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

