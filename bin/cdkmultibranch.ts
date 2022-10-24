#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkmultibranchStack } from '../lib/cdkmultibranch-stack';

const app = new cdk.App();
new CdkmultibranchStack(app, 'CdkmultibranchStack');
