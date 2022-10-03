# Welcome to the sample application

You should explore the contents of this project. It demonstrates a CDK app with an instance of a stack (`CdkmultibranchStack`) - It creates an API gateway and single Lambda

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Commands

* `cdk bootstrap`      bootstrap your AWS account 
* `npm install`     Install required packages
* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk synth`       emits the synthesized CloudFormation template
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state

## Accessing your basic application

Once the application is deployed, you will be able to access the API endpoint at:
https://<API Gateway ID>.execute-api.<region>.amazonaws.com/prod/app