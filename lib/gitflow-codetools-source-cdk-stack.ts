import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as api from 'aws-cdk-lib/aws-apigateway';

export class GitflowCodetoolsSourceCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Basic Hello World Lambda Function
    const appLambda = new lambda.Function(this, 'appHandler', {
      runtime: lambda.Runtime.NODEJS_16_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'app.handler'
    });

    //API Gateway for our application
    const appApi = new api.RestApi(this, 'app', {
      description: 'API Gateway for Example Application',
      deployOptions: {
        stageName: 'prod',
      },
    });

    //add method to API gateway to GET basic app with path /prod/app
    const appPath = appApi.root.addResource('app');
    appPath.addMethod(
      'GET',
      new api.LambdaIntegration(appLambda, {proxy: true}),
    );

    //output API Gateway URL
    new cdk.CfnOutput(this, 'apiUrl', {value: appApi.url});

  }
}
