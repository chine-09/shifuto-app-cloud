#!/usr/bin/env node
import "source-map-support/register.js";
import { App } from "aws-cdk-lib";
import { ShifutoCloudStack } from "../lib/shifuto-cloud-stack";

const app = new App();

new ShifutoCloudStack(app, "ShifutoCloudStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
  },
  // Must be globally unique across all AWS accounts (Cognito Hosted UI domain).
  cognitoDomainPrefix: app.node.tryGetContext("cognitoDomainPrefix") ?? "shifuto-cloud",
  devOrigin: "http://localhost:5173",
});
